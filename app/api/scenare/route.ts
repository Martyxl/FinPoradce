import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AIScenarioBuilder } from "@/lib/aiAnalyzer";
import type { CalculationResult, Scenare3 } from "@/lib/types";

export const runtime = "nodejs";
// AI volani trva jednotky az desitky sekund — zvednout limit Vercel funkce.
export const maxDuration = 60;

// ---- Best-effort ochrany (in-memory; na serverless per-instance) ----
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map<string, number[]>();

const responseCache = new Map<string, { at: number; data: Scenare3 }>();
const RESPONSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateLimitMap.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (hits.length >= RATE_LIMIT_MAX) return true;
  hits.push(now);
  rateLimitMap.set(ip, hits);
  return false;
}

function profileHash(calc: CalculationResult): string {
  // Deterministicky klic pro cache odpovedi — stejny profil => stejne balicky
  const raw = JSON.stringify(calc.profile_echo) + "|" + calc.max_loan;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return String(hash);
}

export async function POST(req: Request) {
  // Kill switch pro pripad exploze nakladu
  if (process.env.AI_DISABLED === "1") {
    return NextResponse.json(
      { detail: "AI doporučení je dočasně vypnuté." },
      { status: 503 },
    );
  }

  if (!AIScenarioBuilder.isConfigured()) {
    return NextResponse.json(
      {
        detail:
          "AI doporučení není nakonfigurované (chybí ANTHROPIC_API_KEY na serveru).",
      },
      { status: 503 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { detail: "Příliš mnoho požadavků — zkuste to za pár minut." },
      { status: 429 },
    );
  }

  let calculation: CalculationResult;
  try {
    calculation = (await req.json()) as CalculationResult;
  } catch {
    return NextResponse.json({ detail: "Neplatné tělo požadavku." }, { status: 400 });
  }
  if (
    !calculation ||
    typeof calculation !== "object" ||
    !calculation.profile_echo ||
    !Array.isArray(calculation.per_bank)
  ) {
    return NextResponse.json(
      { detail: "Chybí výsledek výpočtu — nejdřív spočítejte hypotéku." },
      { status: 422 },
    );
  }

  // Cache: stejny profil behem 24 h => stejne balicky bez dalsiho AI volani
  const key = profileHash(calculation);
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.at < RESPONSE_CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const builder = new AIScenarioBuilder();
    const scenare = await builder.build(calculation);
    responseCache.set(key, { at: Date.now(), data: scenare });
    return NextResponse.json(scenare);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { detail: "Neplatný API klíč pro AI službu." },
        { status: 503 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { detail: "AI služba je momentálně vytížená — zkuste to za chvíli." },
        { status: 503 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic APIError:", err.status, err.message);
      if (err.message.includes("credit balance")) {
        return NextResponse.json(
          {
            detail:
              "AI služba není aktivní — na účtu Anthropic chybí kredit (Console → Plans & Billing).",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { detail: `AI služba vrátila chybu (${err.status}): ${err.message}` },
        { status: 502 },
      );
    }
    const message = err instanceof Error ? err.message : "Interní chyba";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
