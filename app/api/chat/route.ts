import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ChatZprava } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 45;

// ---- Rate limit (per-instance) ----
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30; // chat ma vic kol nez scenare
const rateMap = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateMap.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) return true;
  hits.push(now);
  rateMap.set(ip, hits);
  return false;
}

// ---- Strukturovany vystup ----
const ProfilSchema = z.object({
  cisty_prijem_mesicne: z.number().nullable(),
  typ_prijmu: z.enum(["zamestnanec", "osvc", "jiny"]).nullable(),
  vek: z.number().nullable(),
  pocet_osob_domacnost: z.number().nullable(),
  pocet_deti: z.number().nullable(),
  ucel: z.enum(["vlastni_bydleni", "investicni"]).nullable(),
  hodnota_nemovitosti: z.number().nullable(),
  vlastni_zdroje: z.number().nullable(),
  splatnost_roky: z.number().nullable(),
  fixace_roky: z.number().nullable(),
  typ_pozadavku: z.enum(["koupe", "uver_proti_nemovitosti"]).nullable(),
  zbyvajici_dluh_nemovitost_czk: z.number().nullable(),
  pozadovana_castka_czk: z.number().nullable(),
  osvc_obor: z
    .enum([
      "it_programovani",
      "marketing_poradenstvi_kreativa",
      "advokacie_lekar_notarstvi",
      "obecne_volne_zivnosti",
      "remeslne_zivnosti",
      "zemedelska_vyroba",
    ])
    .nullable(),
  osvc_rocni_obrat_czk: z.number().nullable(),
});

const ChatSchema = z.object({
  odpoved: z
    .string()
    .describe(
      "Odpověď klientovi česky, přátelsky, 1-3 věty. Doptej se na chybějící klíčový údaj nebo potvrď shrnutí. Žádný prodejní tlak.",
    ),
  potreba: z
    .enum(["bydleni", "zajisteni", "sporeni"])
    .nullable()
    .describe(
      "Klasifikuj, co klient řeší: bydleni (hypotéka, koupě/refinancování/úvěr proti nemovitosti), zajisteni (pojištění rizik — život, majetek, příjem, odpovědnost), sporeni (rezerva, investice, penze, spoření na cíl). null, dokud to z konverzace nelze určit.",
    ),
  profil: ProfilSchema.describe(
    "Vše, co se zatím podařilo z konverzace zjistit. Pole, která klient nezmínil, nech null. Částky v CZK, věk v letech.",
  ),
  pripraveno: z
    .boolean()
    .describe(
      "true, jakmile máš pro danou potřebu MINIMUM. Bydlení: příjem (nebo OSVČ obor+obrat), věk, hodnotu nemovitosti a zdroje/dluh. Zajištění a spoření: stačí příjem a věk (zbytek doladí formulář).",
    ),
  chybi_klicove: z
    .array(z.string())
    .describe("Lidský seznam klíčových údajů, které ještě chybí."),
});

const SYSTEM = `Jsi přátelský asistent FinSei — nezávislého finančního poradce pro český trh. Z volného rozhovoru s klientem nejdřív rozpoznáš, CO ŘEŠÍ, a podle toho posbíráš parametry.

TŘI POTŘEBY (pole potreba):
- bydleni — hypotéka, koupě nebo refinancování nemovitosti, úvěr proti stávající nemovitosti
- zajisteni — pojištění rizik (život, invalidita, příjem, majetek, odpovědnost)
- sporeni — budování rezervy, investice, penze, spoření na cíl
Pokud klient řeší víc věcí, vyber tu hlavní, kterou zmínil první / nejvíc. Dokud to nejde určit, nech potreba=null a zeptej se.

Podle potřeby sbíráš parametry:
- Pro BYDLENÍ pokračuj jako hypoteční asistent (viz níže).
- Pro ZAJIŠTĚNÍ a SPOŘENÍ stačí zjistit příjem a věk; detaily (rodina, co už má, cíl, u spoření kolik odkládá a horizont) doladí krátký formulář — neptej se na všechno, jen orámuj situaci a nastav pripraveno=true.

HYPOTÉČNÍ ČÁST (jen když potreba=bydleni):

JAK VEDEŠ ROZHOVOR:
- Piš česky, lidsky, stručně (1-3 věty). Žádné formuláře, žádný prodejní tlak.
- Ptej se VŽDY jen na jednu, max dvě věci najednou. Nejdřív to nejdůležitější.
- Reaguj na to, co klient napsal — potvrď, co jsi pochopil, pak se doptej.
- Když klient uvede částku slovy ("4 miliony", "4,2 mil"), převeď na číslo v CZK.
- OSVČ: pokud řekne, že podniká, zeptej se na obor a roční obrat (z toho odhadneme reálný příjem). Pokud zná svůj čistý měsíční příjem, stačí ten.
- Rozliš, zda klient KUPUJE nemovitost (typ_pozadavku=koupe, ptej se na vlastní zdroje) nebo chce PŮJČIT PROTI STÁVAJÍCÍ nemovitosti, jejíž hodnota vzrostla (typ_pozadavku=uver_proti_nemovitosti, ptej se na zbývající dluh).

MINIMUM PRO VÝPOČET (pak nastav pripraveno=true):
- příjem (čistý měsíční, nebo OSVČ obor + roční obrat)
- věk
- hodnota nemovitosti
- vlastní zdroje (u koupě) / zbývající dluh (u úvěru proti nemovitosti)
Vše ostatní (počet osob, děti, fixace, splatnost, účel) je volitelné — má rozumné defaulty, doptej se jen pokud to klient sám nakousne nebo když je vše hlavní hotové.

Když je pripraveno=true, v odpovědi krátce shrň, co jsi pochopil, a vyzvi klienta, ať pokračuje k detailní analýze (tlačítko se objeví samo). Do profilu vždy vrať VŠE, co už víš z celé konverzace (ne jen z poslední zprávy), a vždy nastav pole potreba.`;

export async function POST(req: Request) {
  if (process.env.AI_DISABLED === "1") {
    return NextResponse.json(
      { detail: "AI chat je dočasně vypnutý." },
      { status: 503 },
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        detail:
          "AI chat není nakonfigurovaný (chybí ANTHROPIC_API_KEY na serveru).",
      },
      { status: 503 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { detail: "Příliš mnoho zpráv — zkuste to za chvíli." },
      { status: 429 },
    );
  }

  let body: { zpravy: ChatZprava[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Neplatné tělo požadavku." }, { status: 400 });
  }
  if (!Array.isArray(body.zpravy) || body.zpravy.length === 0) {
    return NextResponse.json({ detail: "Chybí zprávy." }, { status: 422 });
  }
  // Limit delky historie (ochrana proti zneuziti)
  const zpravy = body.zpravy.slice(-20);

  try {
    const client = new Anthropic();
    const model = process.env.AI_CHAT_MODEL ?? process.env.AI_MODEL ?? "claude-opus-4-8";

    const response = await client.messages.parse({
      model,
      max_tokens: 1500,
      system: SYSTEM,
      messages: zpravy.map((z) => ({
        role: z.role,
        content: z.text,
      })),
      output_config: {
        format: zodOutputFormat(ChatSchema),
        effort: "low",
      },
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new Error("AI nevrátila platný výstup.");
    }

    // null -> undefined pro cisty ChatProfil
    const profil: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.profil)) {
      if (v !== null && v !== undefined) profil[k] = v;
    }

    return NextResponse.json({
      odpoved: parsed.odpoved,
      profil,
      pripraveno: parsed.pripraveno,
      chybi_klicove: parsed.chybi_klicove ?? [],
      potreba: parsed.potreba ?? null,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { detail: "Neplatný API klíč pro AI službu." },
        { status: 503 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { detail: "AI služba je vytížená — zkuste to za chvíli." },
        { status: 503 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      if (err.message.includes("credit balance")) {
        return NextResponse.json(
          {
            detail:
              "AI chat není aktivní — na účtu Anthropic chybí kredit (Console → Plans & Billing).",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { detail: `AI služba vrátila chybu (${err.status}).` },
        { status: 502 },
      );
    }
    const message = err instanceof Error ? err.message : "Interní chyba";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
