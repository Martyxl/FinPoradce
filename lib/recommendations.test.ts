import { describe, it, expect } from "vitest";
import { BonitaCalculator } from "./bonita";
import { RecommendationEngine } from "./recommendations";
import {
  loadBanks,
  loadCnbRules,
  loadInstituce,
  loadScoringPravidla,
} from "./data";
import { makeProfile, produkt } from "./testProfile";
import type { CustomerProfile, Doporuceni } from "./types";

function evaluate(profile: CustomerProfile): Doporuceni[] {
  const calc = new BonitaCalculator(
    loadBanks(),
    loadCnbRules(),
    loadScoringPravidla(),
  );
  const result = calc.calculate(profile);
  const engine = new RecommendationEngine(
    loadInstituce(),
    loadScoringPravidla(),
  );
  return engine.evaluate(profile, result);
}

function najdi(d: Doporuceni[], id: string) {
  return d.find((x) => x.id === id);
}

describe("RecommendationEngine — rizikové ŽP k hypotéce", () => {
  it("bez ŽP → CHYBI s návrhem rizikového ŽP", () => {
    const d = evaluate(makeProfile());
    const rzp = najdi(d, "rzp_k_hypotece");
    expect(rzp?.kategorie).toBe("CHYBI");
    expect(rzp?.odhadovane_pojistne_mesicne_czk).toBeGreaterThan(0);
  });

  it("jen pojištění schopnosti splácet → NEOPTIMALNI (lepší samostatné RŽP)", () => {
    const d = evaluate(
      makeProfile({
        existujici_produkty: [
          produkt({ kategorie: "schopnost_splacet", mesicni_castka_czk: 650 }),
        ],
      }),
    );
    expect(najdi(d, "rzp_k_hypotece")?.kategorie).toBe("NEOPTIMALNI");
  });

  it("komplexní rizikové ŽP → OK", () => {
    const d = evaluate(
      makeProfile({
        existujici_produkty: [
          produkt({ kategorie: "zp_rizikove", mesicni_castka_czk: 1200 }),
        ],
      }),
    );
    expect(najdi(d, "rzp_k_hypotece")?.kategorie).toBe("OK");
  });
});

describe("RecommendationEngine — balíčkové pojištění nemovitosti", () => {
  it("nemovitost vč. domácnosti → karta domácnosti se nezobrazí", () => {
    const d = evaluate(
      makeProfile({
        existujici_produkty: [
          produkt({
            kategorie: "poj_nemovitosti",
            mesicni_castka_czk: 458,
            zahrnuje_kategorie: ["poj_domacnosti", "poj_odpovednosti"],
          }),
        ],
      }),
    );
    expect(najdi(d, "pojisteni_domacnosti")).toBeUndefined();
    // odpovědnost krytá balíčkem → UPOZORNENI na limit, ne CHYBI
    expect(najdi(d, "pojisteni_odpovednosti")?.kategorie).toBe("UPOZORNENI");
  });
});

describe("RecommendationEngine — DPS", () => {
  it("bez DPS a věk < 60 → CHYBI", () => {
    const d = evaluate(makeProfile({ vek: 35 }));
    expect(najdi(d, "dps")?.kategorie).toBe("CHYBI");
  });

  it("DPS pod 1700 Kč → NEOPTIMALNI", () => {
    const d = evaluate(
      makeProfile({
        vek: 35,
        existujici_produkty: [
          produkt({ kategorie: "dps", mesicni_castka_czk: 500 }),
        ],
      }),
    );
    expect(najdi(d, "dps")?.kategorie).toBe("NEOPTIMALNI");
  });

  it("věk ≥ 60 → DPS pravidlo se neaplikuje", () => {
    const d = evaluate(makeProfile({ vek: 62 }));
    expect(najdi(d, "dps")).toBeUndefined();
  });
});

describe("RecommendationEngine — stavební spoření pro děti", () => {
  it("má děti a žádné SS → CHYBI", () => {
    const d = evaluate(makeProfile({ pocet_deti: 2 }));
    expect(najdi(d, "stavebni_sporeni_deti")?.kategorie).toBe("CHYBI");
  });
  it("bez dětí → pravidlo se neaplikuje", () => {
    const d = evaluate(makeProfile({ pocet_deti: 0 }));
    expect(najdi(d, "stavebni_sporeni_deti")).toBeUndefined();
  });
});

describe("RecommendationEngine — IŽP varování", () => {
  it("drží IŽP → UPOZORNENI s úsporou při rozdělení", () => {
    const d = evaluate(
      makeProfile({
        existujici_produkty: [
          produkt({ kategorie: "zp_investicni", mesicni_castka_czk: 2000 }),
        ],
      }),
    );
    const izp = najdi(d, "investicni_zp_warning");
    expect(izp?.kategorie).toBe("UPOZORNENI");
    expect(izp?.uspora_mesicne_czk).toBeGreaterThan(0);
  });
});

describe("RecommendationEngine — řazení", () => {
  it("CHYBI je seřazeno před OK", () => {
    const d = evaluate(makeProfile());
    const order = { CHYBI: 0, NEOPTIMALNI: 1, UPOZORNENI: 2, OK: 3 };
    for (let i = 1; i < d.length; i++) {
      expect(order[d[i].kategorie]).toBeGreaterThanOrEqual(
        order[d[i - 1].kategorie],
      );
    }
  });
});
