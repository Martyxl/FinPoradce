/**
 * Izolovany modul doporuceni "chytreho zajisteni" — pravidlovy system
 * pracujici se stavajicimi produkty klienta, vysledkem hypoteky a databazi
 * instituci. Vraci konkretni instituce + odhady pojistneho.
 *
 * Pravidla jsou samostatne metody. Pro nahrazeni systemem (pokrocily
 * pravidlovy strom, ML) staci implementovat stejne rozhrani:
 *   evaluate(profile, calculation) -> Doporuceni[].
 */
import type {
  CalculationResult,
  CustomerProfile,
  Doporuceni,
  ExistingProduct,
  NavrhovanaInstituce,
  ProduktKategorie,
} from "./types";
import type { InstituceData, InstituceItem, ScoringPravidla } from "./data";
import { PremiumEstimator } from "./premiumEstimator";

// ---- Mapy podilu pojistoven dle CAP 2023 (jen pro razeni) ----
// Hodnoty primo ze synced instituce.json -> trzni_podil_celkem_2023_procent
const POJISTOVNY_PODIL_CELKEM: Record<string, number> = {
  generali_ceska: 24.1,
  kooperativa: 23.4,
  allianz: 11.6,
  csob_poj: 9.0,
  cpp: 8.3,
  uniqa: 7.8,
  nn: 2.8,
  cardif: 2.2,
  direct: 2.0,
  metlife: 1.8,
  komercni_poj: 1.6,
};
// Pro životní pojištění silnější hráči
const POJISTOVNY_PODIL_ZIV: Record<string, number> = {
  kooperativa: 30.4,
  generali_ceska: 20.0,
  nn: 9.1,
  allianz: 7.8,
  uniqa: 7.5,
  csob_poj: 7.4,
  cpp: 5.8,
  metlife: 5.4,
  komercni_poj: 3.2,
};

export class RecommendationEngine {
  private estimator: PremiumEstimator;
  private vsechnyPojistovny: InstituceItem[];
  private vsechnePenzijni: InstituceItem[];
  private vsechnyStavebniSporitelny: InstituceItem[];

  constructor(instituce: InstituceData, scoring: ScoringPravidla) {
    this.estimator = new PremiumEstimator(scoring);
    this.vsechnyPojistovny = instituce.pojistovny ?? [];
    this.vsechnePenzijni = instituce.penzijni_spolecnosti ?? [];
    this.vsechnyStavebniSporitelny = instituce.stavebni_sporitelny ?? [];
  }

  // ---- Pomocne ----
  private najdiProdukt(
    profile: CustomerProfile,
    kategorie: ProduktKategorie,
  ): ExistingProduct | undefined {
    return profile.existujici_produkty.find((p) => p.kategorie === kategorie);
  }

  private maJakoukoliv(
    profile: CustomerProfile,
    kategorie: ProduktKategorie[],
  ): boolean {
    return profile.existujici_produkty.some((p) =>
      kategorie.includes(p.kategorie),
    );
  }

  /** Kryti primo produktem NEBO v ramci balicku (zahrnuje_kategorie). */
  private jeKryto(
    profile: CustomerProfile,
    kategorie: ProduktKategorie,
  ): { kryto: boolean; pres_balicek: boolean } {
    if (this.najdiProdukt(profile, kategorie)) {
      return { kryto: true, pres_balicek: false };
    }
    const balicek = profile.existujici_produkty.some((p) =>
      p.zahrnuje_kategorie?.includes(kategorie),
    );
    return { kryto: balicek, pres_balicek: balicek };
  }

  private topPojistovnyZiv(n = 3): NavrhovanaInstituce[] {
    return this.vsechnyPojistovny
      .filter((p) => POJISTOVNY_PODIL_ZIV[p.id] !== undefined)
      .sort(
        (a, b) =>
          (POJISTOVNY_PODIL_ZIV[b.id] ?? 0) - (POJISTOVNY_PODIL_ZIV[a.id] ?? 0),
      )
      .slice(0, n)
      .map((p) => ({
        id: p.id,
        nazev: p.nazev,
        duvod: `Tržní podíl v ŽP ${POJISTOVNY_PODIL_ZIV[p.id]} % (ČAP 2023)`,
      }));
  }

  private topPojistovnyNez(n = 3): NavrhovanaInstituce[] {
    return this.vsechnyPojistovny
      .filter((p) => POJISTOVNY_PODIL_CELKEM[p.id] !== undefined)
      .sort(
        (a, b) =>
          (POJISTOVNY_PODIL_CELKEM[b.id] ?? 0) -
          (POJISTOVNY_PODIL_CELKEM[a.id] ?? 0),
      )
      .slice(0, n)
      .map((p) => ({
        id: p.id,
        nazev: p.nazev,
        duvod: `Tržní podíl ${POJISTOVNY_PODIL_CELKEM[p.id]} % (ČAP 2023)`,
      }));
  }

  private topPenzijni(n = 3): NavrhovanaInstituce[] {
    // Penzijni spolecnosti - bez konkretnich procent, vybereme overene znacky
    const priority = ["csps", "csobps_stabilita", "kbps", "allianz_ps", "nn_ps"];
    return this.vsechnePenzijni
      .sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id))
      .filter((_p, i) => i < n)
      .map((p) => ({ id: p.id, nazev: p.nazev }));
  }

  private topStavebniSporitelny(n = 3): NavrhovanaInstituce[] {
    return this.vsechnyStavebniSporitelny.slice(0, n).map((s) => ({
      id: s.id,
      nazev: s.nazev,
    }));
  }

  // ---- Pravidla ----
  private pravidloRzpKHypotece(
    profile: CustomerProfile,
    calc: CalculationResult,
  ): Doporuceni {
    const maKomplexniZp = this.maJakoukoliv(profile, [
      "zp_rizikove",
      "zp_investicni",
      "zp_kapitalove",
    ]);
    const schopnostSplacet = this.najdiProdukt(profile, "schopnost_splacet");
    const doporucenaPc = calc.max_loan > 0 ? calc.max_loan : 0;

    const odhadRzpMesicne = this.estimator.rzpKlesajiciMesicne(
      profile.vek,
      doporucenaPc,
    );

    if (maKomplexniZp) {
      return {
        id: "rzp_k_hypotece",
        kategorie: "OK",
        priorita: 1,
        nadpis: "Životní pojištění k hypotéce máte",
        popis:
          "Máte komplexní životní pojištění, které kryje výpadek příjmu při neočekávané události.",
        proc: [
          "Ověřte, že pojistná částka pro případ smrti pokrývá výši hypotéky.",
          "Ideálně klesající pojistná částka odpovídající zůstatku úvěru — pojistné je v čase nižší.",
          "Pojistka není vázaná na konkrétní banku → při refinancování ji ponecháte.",
        ],
        doporucena_castka_czk: doporucenaPc,
        souvisejici_kategorie_produktu: [
          "zp_rizikove",
          "zp_investicni",
          "zp_kapitalove",
        ],
      };
    }

    if (schopnostSplacet) {
      const bankovniMesicne = schopnostSplacet.mesicni_castka_czk;
      const usporaMesicne = bankovniMesicne - odhadRzpMesicne;
      return {
        id: "rzp_k_hypotece",
        kategorie: "NEOPTIMALNI",
        priorita: 1,
        nadpis: "Pojištění schopnosti splácet — lepší je nezávislé rizikové ŽP",
        popis:
          "Pojištění schopnosti splácet od banky kryje jen tuto jednu hypotéku a v poměru cena/krytí je obvykle horší než samostatné rizikové životní pojištění.",
        proc: [
          "Bankovní pojistka zaniká při refinancování — zaplacené pojistné se vám nikam nepřevádí.",
          "Komplexní rizikové ŽP kryje smrt, invaliditu I.–III. stupně, vážná onemocnění i pracovní neschopnost — ne jen splátku úvěru.",
          "Rizikové ŽP s klesající pojistnou částkou kopíruje zůstatek hypotéky → pojistné v čase klesá.",
          "Hypotéka je dlouhodobý závazek (25–30 let). Komplexní pojistka chrání celou rodinu, ne jen tento jeden úvěr.",
        ],
        doporucena_akce:
          "Nahradit pojištění schopnosti splácet samostatným rizikovým životním pojištěním s klesající pojistnou částkou ve výši hypotéky.",
        doporucena_castka_czk: doporucenaPc,
        souvisejici_kategorie_produktu: ["schopnost_splacet", "zp_rizikove"],
        navrhovane_instituce: this.topPojistovnyZiv(3),
        odhadovane_pojistne_mesicne_czk: odhadRzpMesicne,
        uspora_mesicne_czk: usporaMesicne,
        uspora_popis:
          usporaMesicne > 0
            ? `Při srovnatelném krytí ušetříte cca ${Math.round(usporaMesicne)} Kč/měs proti bankovní pojistce a získáte navíc krytí invalidity a vážných onemocnění.`
            : `Pojistné je podobné, ale RŽP kryje výrazně víc rizik a zůstává i při refinancování. Reálná hodnota je vyšší.`,
      };
    }

    return {
      id: "rzp_k_hypotece",
      kategorie: "CHYBI",
      priorita: 1,
      nadpis: "Chytré zajištění hypotéky: rizikové životní pojištění",
      popis:
        "K hypotéce je životní pojištění zásadní. Místo bankovního pojištění schopnosti splácet doporučujeme komplexní rizikové životní pojištění od nezávislé pojišťovny.",
      proc: [
        "Hypotéka je závazek na 25–30 let. Vážná nemoc, úraz nebo úmrtí mohou rodině znemožnit splácení.",
        "Banka nabídne pojištění schopnosti splácet. To je vázané jen na tento úvěr, dražší v poměru ke krytí a zaniká při refinancování.",
        "Komplexní rizikové ŽP kryje smrt, invaliditu I.–III. stupně, vážná onemocnění a pracovní neschopnost. Není vázané na konkrétní banku.",
        "Doporučená pojistná částka odpovídá výši hypotéky a klesá s tím, jak ji splácíte → pojistné v čase nižší.",
      ],
      doporucena_akce:
        "Sjednat samostatné rizikové životní pojištění s klesající pojistnou částkou ve výši hypotéky a klesajícím profilem dle splátkového kalendáře.",
      doporucena_castka_czk: doporucenaPc,
      souvisejici_kategorie_produktu: ["zp_rizikove"],
      navrhovane_instituce: this.topPojistovnyZiv(3),
      odhadovane_pojistne_mesicne_czk: odhadRzpMesicne,
    };
  }

  private pravidloPojisteniNemovitosti(
    profile: CustomerProfile,
    _calc: CalculationResult,
  ): Doporuceni {
    if (this.najdiProdukt(profile, "poj_nemovitosti")) {
      return {
        id: "pojisteni_nemovitosti",
        kategorie: "OK",
        priorita: 2,
        nadpis: "Pojištění nemovitosti máte",
        popis:
          "Pojištění nemovitosti splňuje podmínku banky pro čerpání hypotéky.",
        proc: [
          "Ověřte, že pojistná částka odpovídá aktuální reprodukční (nové) hodnotě nemovitosti, ne tržní ceně.",
          "Bance je třeba dodat vinkulaci pojistného plnění ve prospěch hypotečního úvěru.",
        ],
        souvisejici_kategorie_produktu: ["poj_nemovitosti"],
      };
    }
    const odhad = this.estimator.pojisteniNemovitostiMesicne(
      profile.hodnota_nemovitosti,
    );
    return {
      id: "pojisteni_nemovitosti",
      kategorie: "CHYBI",
      priorita: 2,
      nadpis: "Pojištění nemovitosti — povinné pro čerpání hypotéky",
      popis:
        "Banka pojištění nemovitosti vyžaduje jako zástavu k úvěru. Bez něj peníze neuvolní.",
      proc: [
        "Pojistná částka by měla odpovídat reprodukční (nové) hodnotě nemovitosti, ne tržní ceně.",
        "Vinkulace ve prospěch banky je standardní požadavek.",
        "I bez hypotéky chrání majetek proti živelním událostem (oheň, voda, vichřice).",
      ],
      doporucena_akce:
        "Sjednat pojištění nemovitosti s pojistnou částkou rovnou hodnotě nemovitosti.",
      doporucena_castka_czk: profile.hodnota_nemovitosti,
      souvisejici_kategorie_produktu: ["poj_nemovitosti"],
      navrhovane_instituce: this.topPojistovnyNez(3),
      odhadovane_pojistne_mesicne_czk: odhad,
    };
  }

  private pravidloPojisteniDomacnosti(
    profile: CustomerProfile,
    _calc: CalculationResult,
  ): Doporuceni | null {
    if (this.jeKryto(profile, "poj_domacnosti").kryto) return null;
    return {
      id: "pojisteni_domacnosti",
      kategorie: "CHYBI",
      priorita: 3,
      nadpis: "Pojištění domácnosti — vybavení a movitý majetek",
      popis:
        "Pojištění nemovitosti kryje budovu, ale ne vybavení. Pojištění domácnosti kryje nábytek, elektroniku, oblečení a další movitý majetek proti krádeži, požáru a vodě.",
      proc: [
        "Často se kombinuje s pojištěním nemovitosti u stejné pojišťovny se slevou.",
        "Pojistná částka by měla odpovídat odhadní hodnotě vybavení (typicky 300–800 tis. Kč).",
      ],
      doporucena_akce:
        "Sjednat pojištění domácnosti (typicky v balíčku s pojištěním nemovitosti).",
      souvisejici_kategorie_produktu: ["poj_domacnosti"],
      navrhovane_instituce: this.topPojistovnyNez(3),
      odhadovane_pojistne_mesicne_czk:
        this.estimator.pojisteniDomacnostiMesicne(500000),
    };
  }

  private pravidloPojisteniOdpovednosti(
    profile: CustomerProfile,
    _calc: CalculationResult,
  ): Doporuceni | null {
    const kryti = this.jeKryto(profile, "poj_odpovednosti");
    if (kryti.kryto && !kryti.pres_balicek) return null;
    if (kryti.pres_balicek) {
      return {
        id: "pojisteni_odpovednosti",
        kategorie: "UPOZORNENI",
        priorita: 3,
        nadpis: "Odpovědnost máte v balíčku — zkontrolujte limit",
        popis:
          "Odpovědnost za škodu máte krytou v rámci balíčku (typicky s pojištěním nemovitosti). Balíčkové limity ale bývají nižší — často 2 mil. Kč.",
        proc: [
          "Doporučený limit odpovědnosti je 5–10 mil. Kč — škody na zdraví třetí osoby se snadno vyšplhají do milionů.",
          "Navýšení limitu v balíčku nebo samostatná smlouva stojí řádově stokoruny ročně.",
        ],
        doporucena_akce:
          "Zkontrolovat limit odpovědnosti v balíčkové smlouvě; pokud je pod 5 mil. Kč, navýšit.",
        souvisejici_kategorie_produktu: ["poj_odpovednosti"],
      };
    }
    return {
      id: "pojisteni_odpovednosti",
      kategorie: "CHYBI",
      priorita: 3,
      nadpis: "Pojištění odpovědnosti za škodu",
      popis:
        "Kryje škody, které způsobíte třetí osobě (zdraví nebo na majetku). Levné pojištění s vysokým potenciálním dopadem.",
      proc: [
        "Roční pojistné typicky 1–3 tis. Kč, krytí v řádu milionů.",
        "Bez něj může jedna nehoda (např. způsobená dětmi nebo psem) finančně zničit rodinu.",
      ],
      doporucena_akce:
        "Sjednat pojištění odpovědnosti za škodu v běžném životě, ideálně s limitem 5–10 mil. Kč.",
      souvisejici_kategorie_produktu: ["poj_odpovednosti"],
      navrhovane_instituce: this.topPojistovnyNez(3),
      odhadovane_pojistne_mesicne_czk:
        this.estimator.pojisteniOdpovednostiMesicne(10000000),
    };
  }

  private pravidloDps(
    profile: CustomerProfile,
    _calc: CalculationResult,
  ): Doporuceni | null {
    if (profile.vek >= 60) return null;
    const dps = this.najdiProdukt(profile, "dps");

    if (!dps) {
      return {
        id: "dps",
        kategorie: "CHYBI",
        priorita: 4,
        nadpis: "Doplňkové penzijní spoření (III. pilíř)",
        popis:
          "Stát přispívá až 340 Kč/měs (4 080 Kč/rok) k vašemu vkladu. Jeden z nejlepších lehkých produktů na zajištění na penzi.",
        proc: [
          "Státní příspěvek 20 % z vlastního vkladu, max. 340 Kč/měs při vkladu 1 700 Kč/měs.",
          "Vklady nad 1 700 Kč/měs jsou daňově odčitatelné (společný limit 48 000 Kč/rok s ŽP, DIP a poj. dlouhodobé péče).",
          "Příspěvek zaměstnavatele je osvobozen od daně a odvodů do 50 000 Kč/rok — využijte, pokud nabízí.",
        ],
        doporucena_akce:
          "Sjednat DPS u penzijní společnosti a vkládat min. 1 700 Kč/měs pro maximální státní příspěvek.",
        doporucena_castka_czk: 1700,
        souvisejici_kategorie_produktu: ["dps"],
        navrhovane_instituce: this.topPenzijni(3),
      };
    }

    if (dps.mesicni_castka_czk < 1700) {
      return {
        id: "dps",
        kategorie: "NEOPTIMALNI",
        priorita: 4,
        nadpis: "DPS — vkládáte méně než pro maximální státní příspěvek",
        popis: `Vkládáte ${Math.round(dps.mesicni_castka_czk)} Kč/měs. Maximální státní příspěvek 340 Kč/měs získáte při vkladu 1 700 Kč/měs.`,
        proc: [
          "Stát přispívá 20 % z vašeho vkladu, max. 340 Kč/měs (4 080 Kč/rok).",
          "Navýšení vkladu z dnešní úrovně na 1 700 Kč/měs přidá až 340 Kč státního příspěvku každý měsíc.",
        ],
        doporucena_akce:
          "Navýšit vlastní vklad na 1 700 Kč/měs pro maximum státního příspěvku.",
        doporucena_castka_czk: 1700,
        souvisejici_kategorie_produktu: ["dps"],
      };
    }

    return {
      id: "dps",
      kategorie: "OK",
      priorita: 4,
      nadpis: "DPS s maximálním státním příspěvkem",
      popis:
        "Vkládáte dostatečně pro plné využití státního příspěvku 340 Kč/měs.",
      proc: [
        "Při vyšších vkladech zvažte daňový odpočet (společný limit 48 000 Kč/rok).",
      ],
      souvisejici_kategorie_produktu: ["dps"],
    };
  }

  private pravidloInvesticniZpWarning(
    profile: CustomerProfile,
    _calc: CalculationResult,
  ): Doporuceni | null {
    const izp = this.najdiProdukt(profile, "zp_investicni");
    if (!izp) return null;
    // Stredni odhad uspory pri rozdeleni RZP + DIP (20-40 % -> 30 %)
    const usporaMesicne = Math.round(izp.mesicni_castka_czk * 0.3);
    return {
      id: "investicni_zp_warning",
      kategorie: "UPOZORNENI",
      priorita: 3,
      nadpis: "Investiční životní pojištění (IŽP) — zvažte rozdělení",
      popis:
        "IŽP kombinuje pojištění s investováním, ale obvykle za cenu vysokých poplatků. Investiční složka často tvoří jen 10–15 % z toho, co platíte.",
      proc: [
        "V prvních 2 letech jde až 80 % pojistného na počáteční náklady smlouvy.",
        "Levnější varianta: samostatné rizikové ŽP + samostatný DIP nebo podílový fond.",
        "Při rozdělení na čisté RŽP + DIP klient typicky ušetří 20–40 % při stejném krytí.",
        "Tuto úvahu doporučujeme zkonzultovat nezávisle (mimo banku a mimo pojišťovnu).",
      ],
      doporucena_akce:
        "Spočítat, zda by rozdělení na samostatné rizikové ŽP + DIP nebylo výhodnější.",
      souvisejici_kategorie_produktu: [
        "zp_investicni",
        "zp_rizikove",
        "dip",
      ],
      uspora_mesicne_czk: usporaMesicne,
      uspora_popis: `Při rozdělení na RŽP + DIP byste při stejném krytí mohli ušetřit odhadem ${usporaMesicne} Kč/měs (20–40 % ze současných ${Math.round(izp.mesicni_castka_czk)} Kč), které místo poplatků skutečně investujete.`,
    };
  }

  // ---- Nova pravidla ----
  private pravidloNouzovaRezerva(
    profile: CustomerProfile,
    calc: CalculationResult,
  ): Doporuceni | null {
    const maSporici = !!this.najdiProdukt(profile, "sporici_ucet");
    const prijem = calc.prijem_pouzity_czk ?? profile.cisty_prijem_mesicne;
    const odhadovaneVydaje = prijem * 0.65;

    // Realne zustatky (sporici 100 %, investice/DIP 50 % — semi-likvidni)
    const zustatekLikvidni = profile.existujici_produkty
      .filter((p) => p.kategorie === "sporici_ucet")
      .reduce((a, p) => a + (p.zustatek_czk ?? 0), 0);
    const zustatekSemi = profile.existujici_produkty
      .filter((p) => p.kategorie === "investice" || p.kategorie === "dip")
      .reduce((a, p) => a + (p.zustatek_czk ?? 0), 0);
    const rezervaCelkem = zustatekLikvidni + zustatekSemi * 0.5;

    const rezervaPokrytaMesicu =
      odhadovaneVydaje > 0
        ? (rezervaCelkem > 0 ? rezervaCelkem : profile.vlastni_zdroje) /
          odhadovaneVydaje
        : 0;
    const maRezervu =
      rezervaPokrytaMesicu >= 3 || (rezervaCelkem === 0 && maSporici);

    if (maRezervu) {
      return null; // OK karty pro vsechno nezobrazujeme
    }

    return {
      id: "nouzova_rezerva",
      kategorie: "CHYBI",
      priorita: 2,
      nadpis: "Nouzová rezerva 3–6 měsíců výdajů",
      popis:
        "Před hypotékou si vytvořte likvidní rezervu na 3–6 měsíců výdajů. Kryje výpadky příjmu, opravy nebo nečekané výdaje, aniž byste museli sahat po dalším úvěru.",
      proc: [
        `Odhad vašich měsíčních výdajů: ${Math.round(odhadovaneVydaje).toLocaleString("cs-CZ")} Kč (65 % příjmu).`,
        `Cílová rezerva: ${Math.round(odhadovaneVydaje * 3).toLocaleString("cs-CZ")} – ${Math.round(odhadovaneVydaje * 6).toLocaleString("cs-CZ")} Kč.`,
        "Bez rezervy je riziko delikventního dluhu 40 % vs. 5 % u lidí s plnou rezervou (data CFPB).",
        "Doporučený nástroj: spořicí účet s vysokou bonusovou sazbou (do 4 % p.a. v ČR).",
      ],
      doporucena_akce:
        "Otevřít spořicí účet u banky a nastavit trvalý příkaz alespoň 5–10 % příjmu měsíčně, dokud nedosáhnete 3 měsíční rezervy.",
      doporucena_castka_czk: Math.round(odhadovaneVydaje * 3),
      souvisejici_kategorie_produktu: ["sporici_ucet"],
    };
  }

  private pravidloStavebniSporeniDeti(
    profile: CustomerProfile,
    _calc: CalculationResult,
  ): Doporuceni | null {
    if (profile.pocet_deti <= 0) return null;
    if (this.najdiProdukt(profile, "stavebni_sporeni")) return null;

    return {
      id: "stavebni_sporeni_deti",
      kategorie: "CHYBI",
      priorita: 4,
      nadpis: `Stavební spoření pro děti (${profile.pocet_deti} ${profile.pocet_deti === 1 ? "dítě" : profile.pocet_deti < 5 ? "děti" : "dětí"})`,
      popis:
        "Státní podpora 5 % / max 1 000 Kč/rok na jedno rodné číslo. Pro každé dítě samostatná smlouva = samostatný roční bonus. Vázací doba 6 let.",
      proc: [
        `Pro ${profile.pocet_deti} ${profile.pocet_deti === 1 ? "dítě" : "dětí"} až ${profile.pocet_deti * 1000} Kč/rok státní podpory navíc.`,
        "Vklad 20 000 Kč/rok plně využije státní podporu. Pak peníze pracují v garantované sazbě.",
        "Po 6 letech jsou peníze plně volné — vhodný startovní balíček na studia nebo první bydlení.",
        "Úroky podléhají 15 % srážkové dani, státní podpora ne.",
      ],
      doporucena_akce: `Otevřít stavební spoření pro každé dítě a vkládat min. 1 700 Kč/měs na maximální státní podporu.`,
      doporucena_castka_czk: 1700 * profile.pocet_deti,
      souvisejici_kategorie_produktu: ["stavebni_sporeni"],
      navrhovane_instituce: this.topStavebniSporitelny(3),
    };
  }

  // ---- Verejne rozhrani ----
  evaluate(
    profile: CustomerProfile,
    calculation: CalculationResult,
  ): Doporuceni[] {
    const kandidati: (Doporuceni | null)[] = [
      this.pravidloRzpKHypotece(profile, calculation),
      this.pravidloPojisteniNemovitosti(profile, calculation),
      this.pravidloNouzovaRezerva(profile, calculation),
      this.pravidloPojisteniDomacnosti(profile, calculation),
      this.pravidloPojisteniOdpovednosti(profile, calculation),
      this.pravidloDps(profile, calculation),
      this.pravidloStavebniSporeniDeti(profile, calculation),
      this.pravidloInvesticniZpWarning(profile, calculation),
    ];
    const order: Record<string, number> = {
      CHYBI: 0,
      NEOPTIMALNI: 1,
      UPOZORNENI: 2,
      OK: 3,
    };
    return kandidati
      .filter((d): d is Doporuceni => d !== null)
      .sort((a, b) => {
        const oa = order[a.kategorie] ?? 9;
        const ob = order[b.kategorie] ?? 9;
        if (oa !== ob) return oa - ob;
        return a.priorita - b.priorita;
      });
  }
}
