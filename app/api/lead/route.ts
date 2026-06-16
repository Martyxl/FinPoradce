import { NextResponse } from "next/server";
import type { CalculationResult } from "@/lib/types";

export const runtime = "nodejs";

// ---- Best-effort rate limit (per-instance) ----
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const rateMap = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateMap.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) return true;
  hits.push(now);
  rateMap.set(ip, hits);
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function czk(n: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(n);
}

interface LeadBody {
  email: string;
  telefon?: string;
  jmeno?: string;
  poznamka?: string;
  souhlas: boolean;
  vysledek: CalculationResult;
}

/** Sestavi citelne shrnuti leadu (text + HTML). */
function sestavShrnuti(b: LeadBody): { text: string; html: string } {
  const v = b.vysledek;
  const p = v.profile_echo;
  const topBanky = v.per_bank
    .slice()
    .sort((a, x) => x.max_loan - a.max_loan)
    .slice(0, 3);
  const chybi = v.doporuceni.filter((d) => d.kategorie === "CHYBI");

  const radky: string[] = [];
  radky.push("NOVÝ LEAD — FinSei");
  radky.push("");
  radky.push("== Kontakt ==");
  radky.push(`E-mail: ${b.email}`);
  if (b.jmeno) radky.push(`Jméno: ${b.jmeno}`);
  if (b.telefon) radky.push(`Telefon: ${b.telefon}`);
  if (b.poznamka) radky.push(`Poznámka: ${b.poznamka}`);
  radky.push("");
  radky.push("== Výpočet ==");
  radky.push(`Nejvyšší dosažitelný úvěr: ${czk(v.max_loan)}`);
  radky.push(`Měsíční splátka: ${czk(v.max_monthly_payment)}`);
  radky.push(`Limitující faktor: ${v.limiting_factor}`);
  if (v.financni_zdravi) {
    radky.push(
      `Finanční zdraví: ${v.financni_zdravi.skore_0_100}/100 (${v.financni_zdravi.uroven})`,
    );
  }
  radky.push("");
  radky.push("== Top banky ==");
  for (const bk of topBanky) {
    radky.push(
      `${bk.bank_nazev}: ${czk(bk.max_loan)} | splátka ${czk(bk.max_monthly_payment)} | sazba ${(bk.sazba * 100).toFixed(2)} % | limit ${bk.limiting_factor}`,
    );
  }
  radky.push("");
  radky.push("== Profil ==");
  radky.push(`Příjem (použitý): ${czk(v.prijem_pouzity_czk ?? p.cisty_prijem_mesicne)}/měs · typ ${p.typ_prijmu}`);
  radky.push(`Věk: ${p.vek} · domácnost ${p.pocet_osob_domacnost} · děti ${p.pocet_deti}`);
  radky.push(`Nemovitost: ${czk(p.hodnota_nemovitosti)} · účel ${p.ucel} · ${p.typ_pozadavku ?? "koupe"}`);
  if (p.typ_pozadavku === "uver_proti_nemovitosti") {
    radky.push(`Zbývající dluh na nemovitosti: ${czk(p.zbyvajici_dluh_nemovitost_czk ?? 0)}`);
  } else {
    radky.push(`Vlastní zdroje: ${czk(p.vlastni_zdroje)}`);
  }
  radky.push("");
  if (chybi.length > 0) {
    radky.push("== Mezery v zajištění (CHYBÍ) ==");
    for (const d of chybi) radky.push(`• ${d.nadpis}`);
    radky.push("");
  }
  radky.push(`Stávajících produktů: ${p.existujici_produkty.length}`);
  radky.push("");
  radky.push("Klient odsouhlasil kontakt za účelem zprostředkování smluv a zpracování údajů.");

  const text = radky.join("\n");
  const html = `<pre style="font-family:ui-monospace,monospace;font-size:13px;line-height:1.5">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</pre>`;
  return { text, html };
}

async function odeslatResend(
  b: LeadBody,
  shrnuti: { text: string; html: string },
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_NOTIFY_EMAIL;
  const from = process.env.LEAD_FROM_EMAIL ?? "FinSei <onboarding@resend.dev>";
  if (!key || !to) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: b.email,
      subject: `Nový lead FinSei — ${b.jmeno || b.email}`,
      text: shrnuti.text,
      html: shrnuti.html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
  return true;
}

async function odeslatWebhook(
  b: LeadBody,
  shrnuti: { text: string },
): Promise<boolean> {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return false;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: b.email,
      jmeno: b.jmeno ?? null,
      telefon: b.telefon ?? null,
      poznamka: b.poznamka ?? null,
      shrnuti: shrnuti.text,
      max_loan: b.vysledek.max_loan,
    }),
  });
  if (!res.ok) {
    throw new Error(`Webhook ${res.status}`);
  }
  return true;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { detail: "Příliš mnoho požadavků — zkuste to za pár minut." },
      { status: 429 },
    );
  }

  let body: LeadBody;
  try {
    body = (await req.json()) as LeadBody;
  } catch {
    return NextResponse.json({ detail: "Neplatné tělo požadavku." }, { status: 400 });
  }

  if (!body.email || !EMAIL_RE.test(body.email)) {
    return NextResponse.json(
      { detail: "Zadejte platnou e-mailovou adresu." },
      { status: 422 },
    );
  }
  if (!body.souhlas) {
    return NextResponse.json(
      { detail: "Pro zprostředkování je nutný souhlas se zpracováním údajů." },
      { status: 422 },
    );
  }
  if (
    !body.vysledek ||
    typeof body.vysledek !== "object" ||
    !body.vysledek.profile_echo ||
    !Array.isArray(body.vysledek.per_bank)
  ) {
    return NextResponse.json(
      { detail: "Chybí výsledek výpočtu." },
      { status: 422 },
    );
  }

  const shrnuti = sestavShrnuti(body);

  try {
    const emailOk = await odeslatResend(body, shrnuti);
    const webhookOk = await odeslatWebhook(body, shrnuti);

    if (!emailOk && !webhookOk) {
      // Zadny kanal neni nakonfigurovan
      console.error("LEAD (nedoručeno — chybí konfigurace):\n" + shrnuti.text);
      return NextResponse.json(
        {
          detail:
            "Sběr leadů zatím není nakonfigurovaný. Kontaktujte nás prosím přímo.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("LEAD odeslání selhalo:", err);
    return NextResponse.json(
      { detail: "Odeslání se nezdařilo — zkuste to prosím znovu později." },
      { status: 502 },
    );
  }
}
