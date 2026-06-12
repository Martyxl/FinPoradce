/**
 * Izolovany modul vypoctu bonity. Pevny rozhrani:
 *   calculate(profile: CustomerProfile) -> CalculationResult
 *
 * Pro nahradu presnejsim modelem: implementuj stejne rozhrani a vymen
 * instanci v Route Handleru. BonitaCalculator nezna formular ani UI.
 *
 * Algoritmus per banka:
 *   max_uver = MIN(LTV omezeni, DSTI omezeni, DTI omezeni)
 *   pokud pozadovany uver je nizsi, limitujici faktor = ZADOST
 */
import type {
  BankResult,
  CalculationResult,
  CustomerProfile,
  LimitingFactor,
} from "./types";
import type { BankData, BanksData, CnbRules, ScoringPravidla } from "./data";
import { osvcAnalyzaProfilu } from "./osvc";

export class BonitaCalculator {
  private banks: BankData[];
  private cnb: CnbRules;
  private scoring: ScoringPravidla;

  constructor(
    banksData: BanksData,
    cnbRules: CnbRules,
    scoring: ScoringPravidla,
  ) {
    this.banks = banksData.banky;
    this.cnb = cnbRules;
    this.scoring = scoring;
  }

  // ---- OSVČ pomoc: kterou hodnotu příjmu použít ----
  private efektivniPrijemMesicne(profile: CustomerProfile): number {
    if (profile.typ_prijmu === "osvc") {
      const a = osvcAnalyzaProfilu(profile, this.scoring);
      if (a) return a.realisticky_prijem_mesicne_czk;
    }
    return profile.cisty_prijem_mesicne;
  }

  // ---- Anuitni vzorce ----
  private static anuitaSplatka(
    jistina: number,
    rocniSazba: number,
    nMesicu: number,
  ): number {
    if (rocniSazba <= 0 || nMesicu <= 0) {
      return jistina / Math.max(nMesicu, 1);
    }
    const i = rocniSazba / 12;
    return (jistina * i) / (1 - Math.pow(1 + i, -nMesicu));
  }

  private static anuitaJistina(
    splatka: number,
    rocniSazba: number,
    nMesicu: number,
  ): number {
    if (splatka <= 0) return 0;
    if (rocniSazba <= 0) return splatka * nMesicu;
    const i = rocniSazba / 12;
    return (splatka * (1 - Math.pow(1 + i, -nMesicu))) / i;
  }

  // ---- Vyber sazby ----
  private vyberSazbu(
    bank: BankData,
    fixace: number,
    ltv: number,
  ): { sazba: number; puvod: string } {
    const sazby = bank.sazby ?? [];
    if (sazby.length === 0) return { sazba: 0.05, puvod: "estimate" };

    // Presna shoda fixace + LTV pasmo
    for (const s of sazby) {
      if (s.fixace_roky === fixace && ltv <= s.ltv_do) {
        let base = s.sazba;
        if (ltv > 0.8) base += bank.ltv_prirazka_nad_80 ?? 0;
        return { sazba: base, puvod: s.puvod ?? "estimate" };
      }
    }

    // Fallback: nejblizsi fixace
    const sorted = [...sazby].sort(
      (a, b) =>
        Math.abs(a.fixace_roky - fixace) - Math.abs(b.fixace_roky - fixace),
    );
    const s = sorted[0];
    let base = s.sazba;
    if (ltv > 0.8) base += bank.ltv_prirazka_nad_80 ?? 0;
    return { sazba: base, puvod: s.puvod ?? "estimate" };
  }

  private maxLtvBank(bank: BankData, profile: CustomerProfile): number {
    const cnbLtv = this.cnb.ltv;
    let cnbMax: number;
    if (profile.ucel === "investicni") {
      cnbMax = cnbLtv.investicni_nemovitost.max;
    } else {
      cnbMax =
        profile.vek <= 36
          ? cnbLtv.vlastni_bydleni.max_do_36_let
          : cnbLtv.vlastni_bydleni.max;
    }
    const bankMax = bank.ltv_max ?? 0.9;
    return Math.min(cnbMax, bankMax);
  }

  // ---- Per-banka vypocet ----
  private spoctiBanku(
    bank: BankData,
    profile: CustomerProfile,
    prijemMesicne: number,
    splatkyMesicne: number,
  ): BankResult {
    const poznamky: string[] = [];
    const n = profile.splatnost_roky * 12;
    const protiNemovitosti =
      profile.typ_pozadavku === "uver_proti_nemovitosti";

    // 1) LTV
    const maxLtv = this.maxLtvBank(bank, profile);
    const maxUverLtv = profile.hodnota_nemovitosti * maxLtv;

    let pozadovanyUver: number;
    let uverDleLtv: number;
    let skutecneLtv: number;

    if (protiNemovitosti) {
      // Uver proti stavajici nemovitosti: zastavni kapacita je
      // hodnota x maxLTV MINUS dluh, ktery uz na nemovitosti vazne.
      const stavajiciDluh = Math.max(
        0,
        profile.zbyvajici_dluh_nemovitost_czk ?? 0,
      );
      const kapacita = Math.max(0, maxUverLtv - stavajiciDluh);
      const chce = profile.pozadovana_castka_czk ?? 0;
      pozadovanyUver = chce > 0 ? Math.min(chce, kapacita) : kapacita;
      uverDleLtv = kapacita;
      // LTV pro vyber sazby = celkove zatizeni nemovitosti
      skutecneLtv =
        profile.hodnota_nemovitosti > 0
          ? (stavajiciDluh + pozadovanyUver) / profile.hodnota_nemovitosti
          : 0;
      poznamky.push(
        `Úvěr proti nemovitosti: LTV počítáno včetně stávajícího dluhu ${Math.round(stavajiciDluh).toLocaleString("cs-CZ")} Kč (celkové zatížení ${Math.round(skutecneLtv * 100)} %).`,
      );
      poznamky.push(
        "Neúčelový úvěr (americká hypotéka) mívá nižší max. LTV (60–70 %) a vyšší sazbu než účelová hypotéka — ověřit u banky.",
      );
    } else {
      pozadovanyUver = Math.max(
        0,
        profile.hodnota_nemovitosti - profile.vlastni_zdroje,
      );
      uverDleLtv = Math.min(
        maxUverLtv,
        pozadovanyUver > 0 ? pozadovanyUver : maxUverLtv,
      );
      skutecneLtv =
        profile.hodnota_nemovitosti > 0
          ? uverDleLtv / profile.hodnota_nemovitosti
          : 0;
    }

    // 2) Sazba
    const { sazba, puvod: sazbaPuvod } = this.vyberSazbu(
      bank,
      profile.fixace_roky,
      skutecneLtv,
    );

    // 3) DSTI (interni limit banky)
    const dstiLimit = bank.interni_dsti_limit ?? 0.45;
    const maxSplatkaDsti = Math.max(
      0,
      prijemMesicne * dstiLimit - splatkyMesicne,
    );
    const uverDleDsti = BonitaCalculator.anuitaJistina(
      maxSplatkaDsti,
      sazba,
      n,
    );

    // 4) DTI (interni limit banky)
    const dtiLimit = bank.interni_dti_limit ?? 8;
    const rocniPrijem = prijemMesicne * 12;
    const maxDluhDti = rocniPrijem * dtiLimit;
    const stavajiciDluhAprox = splatkyMesicne * 12 * 5;
    const uverDleDti = Math.max(0, maxDluhDti - stavajiciDluhAprox);

    // Minimum z LTV/DSTI/DTI
    const kandidati: Record<"LTV" | "DSTI" | "DTI", number> = {
      LTV: uverDleLtv,
      DSTI: uverDleDsti,
      DTI: uverDleDti,
    };
    let limitingFactor: LimitingFactor = "LTV";
    let maxLoan = Number.POSITIVE_INFINITY;
    (Object.keys(kandidati) as Array<keyof typeof kandidati>).forEach((k) => {
      if (kandidati[k] < maxLoan) {
        maxLoan = kandidati[k];
        limitingFactor = k as LimitingFactor;
      }
    });
    maxLoan = Math.max(0, maxLoan);

    if (pozadovanyUver > 0 && pozadovanyUver < maxLoan) {
      maxLoan = pozadovanyUver;
      limitingFactor = "ZADOST";
    }

    const maxMonthly = BonitaCalculator.anuitaSplatka(maxLoan, sazba, n);

    const isEstimate =
      bank.puvod_interni_limity === "estimate" || sazbaPuvod === "estimate";

    if (bank.puvod_interni_limity === "estimate") {
      poznamky.push(
        "Interní DSTI/DTI limity banky jsou odhad — ověřit u banky.",
      );
    }
    if (sazbaPuvod === "estimate") {
      poznamky.push(
        "Sazba převzata z přehledového zdroje — ověřit na webu banky.",
      );
    }
    if (profile.vek > 36 && profile.ucel === "vlastni_bydleni") {
      poznamky.push("Věk nad 36 let: maximální LTV 80 %.");
    }

    return {
      bank_id: bank.id,
      bank_nazev: bank.nazev,
      max_loan: Math.round(maxLoan / 1000) * 1000,
      max_monthly_payment: Math.round(maxMonthly),
      sazba,
      sazba_puvod: sazbaPuvod,
      limiting_factor: limitingFactor,
      is_estimate: isEstimate,
      ltv_pouzite: Math.round(skutecneLtv * 10000) / 10000,
      pozadovany_uver: Math.round(pozadovanyUver / 1000) * 1000,
      podminky_slev: bank.slevy_podminky ?? "",
      poznamky,
    };
  }

  // ---- Verejne rozhrani ----
  calculate(profile: CustomerProfile): CalculationResult {
    // Efektivni prijem (OSVC bonus pokud relevantni)
    const prijemMesicne = this.efektivniPrijemMesicne(profile);

    // Splatky = MAX z manualne zadanych (krok 2) a sumy uveru ze stavajicich
    // produktu (krok 3). Tim klient nemuze omylem zapomenout nahlasit splatky.
    const sumaUverovychProduktu = profile.existujici_produkty
      .filter((p) =>
        ["hypoteka_jina", "spotrebitelsky_uver", "leasing", "kreditni_karta"].includes(
          p.kategorie,
        ),
      )
      .reduce((acc, p) => acc + p.mesicni_castka_czk, 0);
    const splatkyMesicne = Math.max(
      profile.stavajici_splatky_mesicne,
      sumaUverovychProduktu,
    );

    const perBank = this.banks.map((b) =>
      this.spoctiBanku(b, profile, prijemMesicne, splatkyMesicne),
    );
    const nejlepsi =
      perBank.length > 0
        ? perBank.reduce((a, b) => (a.max_loan >= b.max_loan ? a : b))
        : undefined;

    const upozorneni = [
      "Výpočet je předběžný odhad. Závazné podmínky určí banka po posouzení.",
      "Interní DSTI/DTI limity bank jsou odhad (puvod=estimate) — ověřit u každé banky.",
      "ČNB má od 2024 DSTI a DTI pro standardní bydlení deaktivované — závazný je jen LTV.",
    ];

    if (sumaUverovychProduktu > 0) {
      upozorneni.push(
        `Stávající splátky ${Math.round(sumaUverovychProduktu).toLocaleString("cs-CZ")} Kč/měs jsme spočítali automaticky z vašich úvěrů ve stávajících produktech.`,
      );
    }
    if (prijemMesicne > profile.cisty_prijem_mesicne) {
      upozorneni.push(
        `OSVČ analýza: pro výpočet bonity jsme použili realistický příjem ${Math.round(prijemMesicne).toLocaleString("cs-CZ")} Kč/měs odvozený z obratu a oboru.`,
      );
    }

    return {
      max_loan: nejlepsi?.max_loan ?? 0,
      max_monthly_payment: nejlepsi?.max_monthly_payment ?? 0,
      limiting_factor: nejlepsi?.limiting_factor ?? "LTV",
      per_bank: perBank,
      profile_echo: profile,
      upozorneni,
      doporuceni: [],
      prijem_pouzity_czk: Math.round(prijemMesicne),
      splatky_pouzite_czk: Math.round(splatkyMesicne),
    };
  }
}
