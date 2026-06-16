import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { RychlyProfil } from "@/lib/types";
import { najdiPotrebu, type PotrebaTyp } from "@/lib/potreby";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---- Rate limit ----
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 8;
const rateMap = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rateMap.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) return true;
  hits.push(now);
  rateMap.set(ip, hits);
  return false;
}

const DATA_DIR = path.join(process.cwd(), "data");
function readData(f: string): string {
  return fs.readFileSync(path.join(DATA_DIR, f), "utf-8");
}

// ---- Strukturovany vystup ----
const ProduktSchema = z.object({
  kategorie: z.string(),
  instituce_id: z.string(),
  nazev: z.string(),
  mesicni_naklad_czk: z.number(),
  proc: z.string(),
});
const KrokSchema = z.object({
  nadpis: z.string(),
  popis: z.string(),
  produkty: z.array(z.string()),
  odhad_mesicne_czk: z.number().nullable(),
});
const PlanSchema = z.object({
  shrnuti: z.string().describe("2-4 věty česky: jak na tom klient je a kam míříme"),
  kroky: z
    .array(KrokSchema)
    .describe("Konkrétní kroky v pořadí priority (3-6), každý s odhadem nákladu"),
  doporucene_produkty: z
    .array(ProduktSchema)
    .describe("Konkrétní produkty/instituce z databáze s orientačním nákladem"),
  upozorneni: z.array(z.string()).describe("Důležité poznámky a rizika"),
});

// Cachovany staticky kontext per potreba (klic = typ potreby)
const systemCache = new Map<PotrebaTyp, Anthropic.TextBlockParam[]>();

const ETIKA = `ETIKA (nikdy neporušuj):
- Nikdy nedoporučuj investiční ani kapitálové životní pojištění jako nový produkt (vysoká nákladovost).
- Nikdy nedoporučuj bankovní pojištění schopnosti splácet — vždy samostatné rizikové ŽP.
- DPS vždy alespoň 1 700 Kč/měs pokud rozpočet dovolí (státní příspěvek 340 Kč/měs).
- Při napjatém rozpočtu raději méně produktů než podpojistit klíčová rizika.
- Instituce uváděj jen z databáze (instituce_id musí existovat, jinak prázdný řetězec). Obchodní názvy jen z číselníku vlajkových produktů s jistotou vysoká/střední.
- Ceny odhaduj jen z cenových koeficientů / tržních očekávání. Vše orientační — finální cenu určí instituce. Nejsi licencovaný poradce.`;

// Instrukce (system prompt) per potreba. Seznam datovych souboru se NEbere
// odtud, ale z lib/potreby.ts (dataZdroje) — jediny zdroj pravdy pro relaci
// potreba -> data. Tady je jen text role/priorit.
const INSTRUKCE: Record<"zajisteni" | "sporeni", string> = {
  zajisteni: `Jsi FinSei — AI finanční sensei pro český trh, nezávislý na bankách a pojišťovnách (žádná provize). Zaměřuješ se na ZAJIŠTĚNÍ rizik. Z profilu klienta sestav konkrétní plán, jak ochránit příjem, rodinu a majetek — bez zbytečně drahých produktů. Vše vyřešíš sám; lidský zásah navrhuj jen jako úplně poslední možnost u skutečně netypických situací.

PRIORITY (přizpůsob situaci klienta z matice životních situací):
1. Rizikové životní pojištění úměrné příjmu/závazkům (živitel rodiny 5-10× roční příjem; klesající PČ u úvěrů). OSVČ: pracovní neschopnost je kritická (nemá nemocenskou).
2. Pojištění nemovitosti a domácnosti, odpovědnost za škodu (levné, vysoký dopad).
3. Invalidita, vážná onemocnění, úraz (zvlášť děti).
4. Pojištění dlouhodobé péče u starších.
Respektuj, co klient UŽ MÁ (nepřidávej duplicitně; nevhodné produkty navrhni vyměnit).

${ETIKA}`,
  sporeni: `Jsi FinSei — AI finanční sensei pro český trh, nezávislý na bankách (žádná provize). Zaměřuješ se na SPOŘENÍ A INVESTICE. Z profilu klienta sestav plán, jak budovat rezervu a zhodnocovat peníze podle jeho cíle a horizontu. Vše vyřešíš sám; lidský zásah navrhuj jen jako úplně poslední možnost.

PRIORITY (v tomto pořadí):
1. Nouzová rezerva 3-6 měsíců výdajů na spořicím účtu (likvidní), než cokoli dalšího.
2. Státem podporované produkty: DPS (III. pilíř, příspěvek 340 Kč/měs při vkladu 1 700, daňový odpočet), stavební spoření (5 %/max 1 000 Kč, i pro děti).
3. Investice podle horizontu a rizikové tolerance — využij tržní očekávání (globální akciové ETF 6-9 % p.a. na 10+ let, dluhopisy, komodity jako doplněk). Časový test 3 roky pro osvobození od daně.
4. Pravidlo: investovat až po vytvoření rezervy; čím delší horizont, tím vyšší podíl akcií.
Pokud klient zmíní podnikání / nemovitost, můžeš stručně nastínit i ROI úvahu. Respektuj, co už má.

${ETIKA}`,
};

function systemProPotrebu(
  potreba: "zajisteni" | "sporeni",
): Anthropic.TextBlockParam[] {
  const hotovo = systemCache.get(potreba);
  if (hotovo) return hotovo;

  const def = najdiPotrebu(potreba);
  const soubory = def?.dataZdroje ?? [];
  // Kontext se sklada z dataZdroje definovanych v lib/potreby.ts
  const kontext = soubory
    .map((f) => `=== ${f} ===\n${readData(f)}`)
    .join("\n\n");

  const blocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: INSTRUKCE[potreba] },
    { type: "text", text: kontext, cache_control: { type: "ephemeral" } },
  ];
  systemCache.set(potreba, blocks);
  return blocks;
}

export async function POST(req: Request) {
  if (process.env.AI_DISABLED === "1") {
    return NextResponse.json({ detail: "AI analýza je dočasně vypnutá." }, { status: 503 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { detail: "AI analýza není nakonfigurovaná (chybí ANTHROPIC_API_KEY na serveru)." },
      { status: 503 },
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ detail: "Příliš mnoho požadavků — zkuste to za chvíli." }, { status: 429 });
  }

  let body: { potreba: "zajisteni" | "sporeni"; profil: RychlyProfil };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Neplatné tělo požadavku." }, { status: 400 });
  }
  if (
    (body.potreba !== "zajisteni" && body.potreba !== "sporeni") ||
    !body.profil ||
    typeof body.profil.cisty_prijem_mesicne !== "number"
  ) {
    return NextResponse.json({ detail: "Chybí typ potřeby nebo profil." }, { status: 422 });
  }

  try {
    const client = new Anthropic();
    const model = process.env.AI_MODEL ?? "claude-opus-4-8";
    const system = systemProPotrebu(body.potreba);

    const response = await client.messages.parse({
      model,
      max_tokens: 8000,
      system,
      messages: [
        {
          role: "user",
          content:
            "Sestav plán pro tohoto klienta.\n\n=== PROFIL ===\n" +
            JSON.stringify(body.profil),
        },
      ],
      output_config: { format: zodOutputFormat(PlanSchema) },
    });

    const parsed = response.parsed_output;
    if (!parsed) throw new Error("AI nevrátila platný výstup.");
    return NextResponse.json(parsed);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      if (err.message.includes("credit balance")) {
        return NextResponse.json(
          { detail: "AI analýza není aktivní — na účtu Anthropic chybí kredit." },
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
