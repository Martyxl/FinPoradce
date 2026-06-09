import { NextResponse } from "next/server";
import { BonitaCalculator } from "@/lib/bonita";
import { RecommendationEngine } from "@/lib/recommendations";
import { loadBanks, loadCnbRules } from "@/lib/data";
import type { CustomerProfile } from "@/lib/types";

export const runtime = "nodejs";

function isValidProfile(p: unknown): p is CustomerProfile {
  if (typeof p !== "object" || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.cisty_prijem_mesicne === "number" && o.cisty_prijem_mesicne > 0 &&
    typeof o.typ_prijmu === "string" &&
    typeof o.vek === "number" && o.vek >= 18 && o.vek <= 99 &&
    typeof o.pocet_osob_domacnost === "number" && o.pocet_osob_domacnost >= 1 &&
    typeof o.pocet_deti === "number" && o.pocet_deti >= 0 &&
    typeof o.stavajici_splatky_mesicne === "number" &&
    typeof o.ucel === "string" &&
    typeof o.hodnota_nemovitosti === "number" && o.hodnota_nemovitosti > 0 &&
    typeof o.vlastni_zdroje === "number" && o.vlastni_zdroje >= 0 &&
    typeof o.splatnost_roky === "number" &&
    typeof o.fixace_roky === "number" &&
    Array.isArray(o.existujici_produkty)
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!isValidProfile(body)) {
      return NextResponse.json(
        { detail: "Neplatný profil — chybí povinné údaje nebo špatný typ." },
        { status: 422 },
      );
    }

    const banksData = loadBanks();
    const cnbRules = loadCnbRules();

    const calc = new BonitaCalculator(banksData, cnbRules);
    const result = calc.calculate(body);

    const engine = new RecommendationEngine();
    result.doporuceni = engine.evaluate(body, result);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interní chyba";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
