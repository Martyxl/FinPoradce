/**
 * Izolovany modul doporuceni "chytreho zajisteni" — pravidlovy system
 * pracujici se stavajicimi produkty klienta a vysledkem hypotecniho vypoctu.
 *
 * Pro nahrazeni jinym systemem (rozsireny pravidlovy strom, ML) staci
 * implementovat stejne rozhrani: evaluate(profile, calculation) -> Doporuceni[].
 */
import type {
  CalculationResult,
  CustomerProfile,
  Doporuceni,
  ExistingProduct,
  ProduktKategorie,
} from "./types";

export class RecommendationEngine {
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
    };
  }

  private pravidloPojisteniDomacnosti(
    profile: CustomerProfile,
    _calc: CalculationResult,
  ): Doporuceni | null {
    if (this.najdiProdukt(profile, "poj_domacnosti")) return null;
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
    };
  }

  private pravidloPojisteniOdpovednosti(
    profile: CustomerProfile,
    _calc: CalculationResult,
  ): Doporuceni | null {
    if (this.najdiProdukt(profile, "poj_odpovednosti")) return null;
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
    if (!this.najdiProdukt(profile, "zp_investicni")) return null;
    return {
      id: "investicni_zp_warning",
      kategorie: "UPOZORNENI",
      priorita: 3,
      nadpis: "Investiční životní pojištění (IŽP) — zvažte rozdělení",
      popis:
        "IŽP kombinuje pojištění s investováním, ale obvykle za cenu vysokých poplatků. Investiční složka často tvoří jen 10–15 % z toho, co platíte.",
      proc: [
        "Levnější varianta: samostatné rizikové ŽP + samostatný DIP nebo podílový fond.",
        "Při zachování stejného krytí a vyšší investiční složky často získáte více.",
        "Tuto úvahu doporučujeme zkonzultovat nezávisle (mimo banku a mimo pojišťovnu).",
      ],
      doporucena_akce:
        "Spočítat, zda by rozdělení na samostatné rizikové ŽP + DIP nebylo výhodnější.",
      souvisejici_kategorie_produktu: [
        "zp_investicni",
        "zp_rizikove",
        "dip",
      ],
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
      this.pravidloPojisteniDomacnosti(profile, calculation),
      this.pravidloPojisteniOdpovednosti(profile, calculation),
      this.pravidloDps(profile, calculation),
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
