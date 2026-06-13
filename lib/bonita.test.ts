import { describe, it, expect } from "vitest";
import { BonitaCalculator } from "./bonita";
import { loadBanks, loadCnbRules, loadScoringPravidla } from "./data";
import { makeProfile, produkt } from "./testProfile";

function calc() {
  return new BonitaCalculator(
    loadBanks(),
    loadCnbRules(),
    loadScoringPravidla(),
  );
}

describe("BonitaCalculator — LTV", () => {
  it("do 36 let umožní LTV 90 %, nad 36 jen 80 %", () => {
    const mlady = calc().calculate(
      makeProfile({ vek: 30, hodnota_nemovitosti: 5000000, vlastni_zdroje: 0 }),
    );
    const stary = calc().calculate(
      makeProfile({ vek: 45, hodnota_nemovitosti: 5000000, vlastni_zdroje: 0 }),
    );
    const ltvMlady = Math.max(...mlady.per_bank.map((b) => b.ltv_pouzite));
    const ltvStary = Math.max(...stary.per_bank.map((b) => b.ltv_pouzite));
    expect(ltvMlady).toBeGreaterThan(0.8);
    expect(ltvMlady).toBeLessThanOrEqual(0.9);
    expect(ltvStary).toBeLessThanOrEqual(0.8 + 1e-9);
  });

  it("investiční nemovitost je omezena na LTV 70 %", () => {
    const r = calc().calculate(
      makeProfile({
        ucel: "investicni",
        vek: 30,
        hodnota_nemovitosti: 5000000,
        vlastni_zdroje: 0,
      }),
    );
    const maxLtv = Math.max(...r.per_bank.map((b) => b.ltv_pouzite));
    expect(maxLtv).toBeLessThanOrEqual(0.7 + 1e-9);
  });

  it("vlastní zdroje snižují potřebný úvěr", () => {
    const r = calc().calculate(
      makeProfile({
        cisty_prijem_mesicne: 200000,
        hodnota_nemovitosti: 4000000,
        vlastni_zdroje: 1500000,
      }),
    );
    // požadovaný úvěr = hodnota - vlastní zdroje = 2,5 mil
    expect(r.max_loan).toBeLessThanOrEqual(2500000);
    expect(r.max_loan).toBeGreaterThan(2000000);
  });
});

describe("BonitaCalculator — DSTI / splátka", () => {
  it("nízký příjem limituje DSTI, ne LTV", () => {
    const r = calc().calculate(
      makeProfile({
        cisty_prijem_mesicne: 30000,
        hodnota_nemovitosti: 8000000,
        vlastni_zdroje: 0,
      }),
    );
    expect(r.limiting_factor).toBe("DSTI");
  });

  it("měsíční splátka odpovídá anuitě (kladná, nižší než úvěr)", () => {
    const r = calc().calculate(makeProfile({ cisty_prijem_mesicne: 80000 }));
    const nejlepsi = r.per_bank.reduce((a, b) =>
      a.max_loan >= b.max_loan ? a : b,
    );
    expect(nejlepsi.max_monthly_payment).toBeGreaterThan(0);
    expect(nejlepsi.max_monthly_payment).toBeLessThan(nejlepsi.max_loan);
  });
});

describe("BonitaCalculator — auto-sync splátek", () => {
  it("sečte úvěrové produkty do stávajících splátek", () => {
    const r = calc().calculate(
      makeProfile({
        existujici_produkty: [
          produkt({ kategorie: "hypoteka_jina", mesicni_castka_czk: 12000 }),
          produkt({ kategorie: "spotrebitelsky_uver", mesicni_castka_czk: 3000 }),
          // spoření se NEpočítá do splátek
          produkt({ kategorie: "dps", mesicni_castka_czk: 1700 }),
        ],
      }),
    );
    expect(r.splatky_pouzite_czk).toBe(15000);
  });
});

describe("BonitaCalculator — OSVČ", () => {
  it("realistický příjem z obratu navýší bonitu IT živnostníka", () => {
    const sObratem = calc().calculate(
      makeProfile({
        typ_prijmu: "osvc",
        cisty_prijem_mesicne: 0,
        osvc_obor: "it_programovani",
        osvc_rocni_obrat_czk: 1800000,
        hodnota_nemovitosti: 6000000,
        vlastni_zdroje: 0,
      }),
    );
    // IT 20 % nákladů → 1,8M × 0,8 / 12 = 120 000 Kč/měs
    expect(sObratem.prijem_pouzity_czk).toBe(120000);
    expect(sObratem.osvc_analyza).not.toBeNull();
  });
});

describe("BonitaCalculator — úvěr proti nemovitosti", () => {
  it("kapacita = hodnota×maxLTV − zbývající dluh (věk 45 → LTV 80 %)", () => {
    const r = calc().calculate(
      makeProfile({
        vek: 45, // nad 36 → CNB max LTV 80 %
        cisty_prijem_mesicne: 200000, // ať nelimituje DSTI
        typ_pozadavku: "uver_proti_nemovitosti",
        hodnota_nemovitosti: 10000000,
        zbyvajici_dluh_nemovitost_czk: 3900000,
        vlastni_zdroje: 0,
      }),
    );
    // LTV 80 %: 8M − 3,9M = 4,1M headroom (banky s nižším ltv_max méně)
    const nejlepsi = r.per_bank.reduce((a, b) =>
      a.max_loan >= b.max_loan ? a : b,
    );
    expect(nejlepsi.max_loan).toBeLessThanOrEqual(4100000);
    expect(nejlepsi.max_loan).toBeGreaterThan(2500000);
    // LTV pro výběr sazby zahrnuje stávající dluh
    expect(nejlepsi.ltv_pouzite).toBeGreaterThan(0.6);
  });

  it("věk 30 → LTV 90 %, vyšší headroom", () => {
    const r = calc().calculate(
      makeProfile({
        vek: 30,
        cisty_prijem_mesicne: 200000,
        typ_pozadavku: "uver_proti_nemovitosti",
        hodnota_nemovitosti: 10000000,
        zbyvajici_dluh_nemovitost_czk: 3900000,
        vlastni_zdroje: 0,
      }),
    );
    // LTV 90 %: 9M − 3,9M = 5,1M headroom
    const nejlepsi = r.per_bank.reduce((a, b) =>
      a.max_loan >= b.max_loan ? a : b,
    );
    expect(nejlepsi.max_loan).toBeLessThanOrEqual(5100000);
    expect(nejlepsi.max_loan).toBeGreaterThan(4100000);
  });
});

describe("BonitaCalculator — porovnání bank", () => {
  it("vrátí všech 10 bank a nezáporné hodnoty", () => {
    const r = calc().calculate(makeProfile());
    expect(r.per_bank.length).toBe(10);
    for (const b of r.per_bank) {
      expect(b.max_loan).toBeGreaterThanOrEqual(0);
      expect(b.sazba).toBeGreaterThan(0);
    }
  });
});
