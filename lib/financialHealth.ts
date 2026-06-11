/**
 * Skore financniho zdravi 0-100 podle CFPB ramce + pomerovych ukazatelu
 * v scoring_pravidla.json.
 *
 * Hodnoti 8 dimenzi: DSTI, DTI, nouzova rezerva, savings rate,
 * fixni vydaje, krytí rizik ZP, krytí rizik majetek, zajisteni penze.
 * Kazda dimenze 0-100 -> vazena prumerna -> celkove skore.
 */
import type {
  CustomerProfile,
  CalculationResult,
  FinancialHealthDimenze,
  FinancialHealthScore,
  ExistingProduct,
  ProduktKategorie,
} from "./types";
import type { ScoringPravidla } from "./data";

const DEBT_KATEGORIE: ProduktKategorie[] = [
  "hypoteka_jina",
  "spotrebitelsky_uver",
  "leasing",
  "kreditni_karta",
];
const SAVING_KATEGORIE: ProduktKategorie[] = [
  "stavebni_sporeni",
  "dps",
  "dip",
  "investice",
  "sporici_ucet",
];
const RZP_KATEGORIE: ProduktKategorie[] = [
  "zp_rizikove",
  "zp_investicni",
  "zp_kapitalove",
];

function sumProduktu(
  produkty: ExistingProduct[],
  kategorie: ProduktKategorie[],
): number {
  return produkty
    .filter((p) => kategorie.includes(p.kategorie))
    .reduce((acc, p) => acc + p.mesicni_castka_czk, 0);
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function linearScore(value: number, perfect: number, fail: number): number {
  // perfect = 100, fail = 0, mezitim linearne
  if (perfect === fail) return 100;
  const t = (value - fail) / (perfect - fail);
  return clamp(t * 100);
}

export class FinancialHealthCalculator {
  constructor(private scoring: ScoringPravidla) {}

  evaluate(
    profile: CustomerProfile,
    calc: CalculationResult,
  ): FinancialHealthScore {
    const dimenze: FinancialHealthDimenze[] = [];
    const vahy = this.scoring.skore_navrh.vahy;

    const prijem = calc.prijem_pouzity_czk ?? profile.cisty_prijem_mesicne;
    const splatkyMesicne = calc.splatky_pouzite_czk ?? profile.stavajici_splatky_mesicne;

    // 1) DSTI dimenze: aktualni + planovana splatka hypoteky
    const planovanaSplatka = calc.max_monthly_payment;
    const dstiAktualni = prijem > 0 ? splatkyMesicne / prijem : 1;
    const dstiSPlanovanou = prijem > 0 ? (splatkyMesicne + planovanaSplatka) / prijem : 1;
    // 100 pri 0 %, 0 pri 45 %+
    const dstiSkore = linearScore(dstiSPlanovanou, 0, 0.45);
    dimenze.push({
      klic: "dsti",
      label: "DSTI (splátky / příjem)",
      skore_0_100: Math.round(dstiSkore),
      vaha: vahy.dsti ?? 0.2,
      komentar: `S plánovanou hypotékou ${Math.round(dstiSPlanovanou * 100)} % (aktuální ${Math.round(dstiAktualni * 100)} %).`,
    });

    // 2) DTI dimenze
    const rocniPrijem = prijem * 12;
    // Aproximace celkového dluhu: stávající × 5 let + plánovaná hypotéka
    const aktualniDluh = splatkyMesicne * 12 * 5 + calc.max_loan;
    const dti = rocniPrijem > 0 ? aktualniDluh / rocniPrijem : 99;
    // 100 pri 0, 0 pri 8+
    const dtiSkore = linearScore(dti, 0, 8);
    dimenze.push({
      klic: "dti",
      label: "DTI (dluh / roční příjem)",
      skore_0_100: Math.round(dtiSkore),
      vaha: vahy.dti ?? 0.15,
      komentar: `Plánovaný dluh ${Math.round(dti * 10) / 10}× ročního příjmu.`,
    });

    // 3) Nouzová rezerva — proxy: má aktivní spořicí účet s pravidelným vkladem
    const maSporici = profile.existujici_produkty.some(
      (p) => p.kategorie === "sporici_ucet",
    );
    // Velmi hrubá proxy: vlastní zdroje > 3 měsíční výdaje
    const odhadovaneVydaje = prijem * 0.65; // 65 % příjmu
    const rezervaZVlastnichZdroju =
      odhadovaneVydaje > 0 ? profile.vlastni_zdroje / odhadovaneVydaje : 0;
    const rezervaSkore = clamp(
      (maSporici ? 50 : 0) + linearScore(rezervaZVlastnichZdroju, 6, 0) * 0.5,
    );
    dimenze.push({
      klic: "rezerva",
      label: "Nouzová rezerva",
      skore_0_100: Math.round(rezervaSkore),
      vaha: vahy.rezerva ?? 0.15,
      komentar: maSporici
        ? "Máte aktivní spořicí účet."
        : "Bez aktivního spořicího účtu — doporučujeme rezervu 3–6 měsíců výdajů.",
    });

    // 4) Savings rate — suma sporení/investování / příjem
    const sumaSporeni = sumProduktu(profile.existujici_produkty, SAVING_KATEGORIE);
    const savingsRate = prijem > 0 ? sumaSporeni / prijem : 0;
    const savingsRateSkore = linearScore(savingsRate, 0.2, 0);
    dimenze.push({
      klic: "savings_rate",
      label: "Míra úspor",
      skore_0_100: Math.round(savingsRateSkore),
      vaha: vahy.savings_rate ?? 0.15,
      komentar: `${Math.round(savingsRate * 100)} % příjmu odkládáte (cíl ≥ 10–20 %).`,
    });

    // 5) Fixní výdaje — proxy: (splátky + nájem [nemáme] + plánovaná hypotéka) / příjem
    // Bez údaje o nájmu nemůžeme přesně, dáme 50 jako neutrální
    dimenze.push({
      klic: "fixni_vydaje",
      label: "Fixní výdaje",
      skore_0_100: 50,
      vaha: vahy.fixni_vydaje ?? 0.1,
      komentar: "Nelze přesně určit bez údajů o nájmu a energiích. Doporučení: ≤ 65 % rozpočtu.",
    });

    // 6) Krytí rizik ŽP
    const maRzp = profile.existujici_produkty.some((p) =>
      RZP_KATEGORIE.includes(p.kategorie),
    );
    const maSchopnostSplacet = profile.existujici_produkty.some(
      (p) => p.kategorie === "schopnost_splacet",
    );
    const zpSkore = maRzp ? 100 : maSchopnostSplacet ? 50 : 0;
    dimenze.push({
      klic: "kryti_zp",
      label: "Krytí rizik (životní pojištění)",
      skore_0_100: zpSkore,
      vaha: vahy["krytí_rizik_zp"] ?? 0.1,
      komentar: maRzp
        ? "Máte komplexní životní pojištění."
        : maSchopnostSplacet
          ? "Pojištění schopnosti splácet je úzké — komplexní RŽP je lepší volba."
          : "Bez životního pojištění — k hypotéce nezbytné.",
    });

    // 7) Krytí rizik majetek (vc. balickovych produktu)
    const maPojNem = profile.existujici_produkty.some(
      (p) =>
        p.kategorie === "poj_nemovitosti" ||
        p.zahrnuje_kategorie?.includes("poj_nemovitosti"),
    );
    const maPojDom = profile.existujici_produkty.some(
      (p) =>
        p.kategorie === "poj_domacnosti" ||
        p.zahrnuje_kategorie?.includes("poj_domacnosti"),
    );
    const majetekSkore = maPojNem && maPojDom ? 100 : maPojNem || maPojDom ? 50 : 0;
    dimenze.push({
      klic: "kryti_majetek",
      label: "Krytí majetku",
      skore_0_100: majetekSkore,
      vaha: vahy["krytí_rizik_majetek"] ?? 0.05,
      komentar:
        maPojNem && maPojDom
          ? "Máte pojištění nemovitosti i domácnosti."
          : maPojNem
            ? "Máte pojištění nemovitosti, chybí domácnost."
            : maPojDom
              ? "Máte pojištění domácnosti, chybí nemovitost (nutné pro hypotéku!)."
              : "Bez pojištění nemovitosti / domácnosti.",
    });

    // 8) Zajištění na penzi
    const dps = profile.existujici_produkty.find((p) => p.kategorie === "dps");
    let penzeSkore = 0;
    let penzeKom = "Bez doplňkového penzijního spoření.";
    if (dps) {
      if (dps.mesicni_castka_czk >= 1700) {
        penzeSkore = 100;
        penzeKom = "DPS s max státním příspěvkem.";
      } else {
        penzeSkore = 60;
        penzeKom = `DPS ${Math.round(dps.mesicni_castka_czk)} Kč/měs — pro max státní příspěvek je třeba 1 700 Kč.`;
      }
    }
    dimenze.push({
      klic: "zajisteni_penze",
      label: "Zajištění na penzi",
      skore_0_100: penzeSkore,
      vaha: vahy.zajisteni_penze ?? 0.1,
      komentar: penzeKom,
    });

    // ---- Celkove skore ----
    const sumaVah = dimenze.reduce((a, d) => a + d.vaha, 0);
    const vazene = dimenze.reduce((a, d) => a + d.skore_0_100 * d.vaha, 0);
    const celkove = sumaVah > 0 ? Math.round(vazene / sumaVah) : 0;

    // Uroven
    const urovne = this.scoring.skore_navrh.urovne;
    const uroven =
      urovne.find((u) => celkove >= u.od_skore)?.label ?? "kritická";

    // Shrnuti
    const chybi = dimenze.filter((d) => d.skore_0_100 < 50).length;
    const shrnuti =
      celkove >= 80
        ? "Vaše finanční zdraví je v dobré kondici. Hypotéka vám pravděpodobně nezpůsobí potíže."
        : celkove >= 65
          ? "Solidní základ. S několika doporučeními budete na finanční zdraví ve výborné kondici."
          : celkove >= 50
            ? `Průměr — máte ${chybi} oblastí, kde je prostor zlepšit. Sledujte sekci Chytré zajištění.`
            : "Pozor: před hypotékou doporučujeme dořešit krytí rizik a vytvořit nouzovou rezervu.";

    return {
      skore_0_100: celkove,
      uroven,
      dimenze,
      shrnuti,
    };
  }
}
