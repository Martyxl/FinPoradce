/**
 * AI analyzator (Faze 10) — izolovany modul, ktery z profilu klienta,
 * vysledku vypoctu a produktove databaze sestavi 3 balicky reseni
 * (nejlevnejsi / standard / luxus) pres Claude API.
 *
 * Architektura (stejny vzor jako BonitaCalculator / RecommendationEngine):
 *   AIScenarioBuilder.build(calculation) -> Scenare3
 *
 * Prompt caching: velky staticky kontext (produktova DB, matice zivotnich
 * situaci, cenove koeficienty, etika) je v system bloku s cache_control —
 * plati se jednou za 5 minut, dalsi requesty ctou z cache (~10 % ceny).
 * Volatilni cast (profil klienta) jde do user message AZ ZA breakpoint.
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { CalculationResult, Scenare3 } from "./types";

// ---- Zod schema pro strukturovany vystup ----
const ScenarProduktSchema = z.object({
  kategorie: z
    .string()
    .describe("Kategorie produktu, napr. zp_rizikove, poj_nemovitosti, dps"),
  instituce_id: z
    .string()
    .describe(
      "ID instituce z databaze (napr. kooperativa, csps). Prazdny retezec, pokud neni konkretni doporuceni.",
    ),
  nazev: z
    .string()
    .describe(
      "Lidsky nazev produktu. Konkretni obchodni nazev POUZE z ciselniku vlajkovych produktu s jistotou vysoka/stredni.",
    ),
  mesicni_naklad_czk: z
    .number()
    .describe("Orientacni mesicni naklad v CZK z cenovych koeficientu"),
  proc: z.string().describe("1-2 vety proc je produkt v balicku, cesky"),
});

const ScenarSchema = z.object({
  uroven: z.enum(["nejlevnejsi", "standard", "luxus"]),
  nadpis: z.string().describe("Kratky cesky nadpis balicku"),
  filozofie: z.string().describe("1 veta - filozofie balicku"),
  produkty: z.array(ScenarProduktSchema),
  mesicni_naklad_celkem_czk: z
    .number()
    .describe("Soucet mesicnich nakladu vsech produktu vc. splatky hypoteky"),
  klady: z.array(z.string()).describe("2-4 kratke body cesky"),
  zapory: z.array(z.string()).describe("1-3 kratke body cesky"),
  vhodnost_pro_klienta: z
    .string()
    .describe(
      "2-4 vety: proc tento balicek (ne)sedi presne teto domacnosti — odkazuj na jejich situaci (deti, OSVC, rezerva...)",
    ),
});

const Scenare3Schema = z.object({
  scenare: z
    .array(ScenarSchema)
    .describe("Presne 3 scenare v poradi: nejlevnejsi, standard, luxus"),
  celkovy_komentar: z
    .string()
    .describe("3-5 vet cesky: shrnuti a doporuceni, ktery balicek zvolit a proc"),
});

// ---- Staticky kontext (cachovatelny) ----
const DATA_DIR = path.join(process.cwd(), "data");

function readData(filename: string): string {
  return fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
}

let cachedSystemBlocks: Anthropic.TextBlockParam[] | null = null;

/**
 * System prompt je zamerne deterministicky (zadne timestampy, zadna
 * nahodna data) — jinak by se prompt cache nikdy netrefila.
 */
function buildSystemBlocks(): Anthropic.TextBlockParam[] {
  if (cachedSystemBlocks) return cachedSystemBlocks;

  const instrukce = `Jsi nezavislý český finanční poradce. Z profilu klienta a produktové databáze sestavíš PŘESNĚ 3 balíčky řešení: "nejlevnejsi" (minimum, které banka vyžaduje + absolutní must-have), "standard" (rozumný kompromis cena/krytí) a "luxus" (kompletní finanční zdraví).

PRAVIDLA (závazná):
1. Každý balíček začíná hypotékou — použij nejlepší banku a měsíční splátku z výpočtu klienta (kategorie "hypoteka", instituce_id = id banky z výpočtu).
2. Instituce vybírej POUZE z databáze institucí níže (pole instituce_id musí být existující id, nebo prázdný řetězec).
3. Konkrétní obchodní názvy produktů smíš použít POUZE z číselníku vlajkových produktů, a jen s jistotou "vysoka" nebo "stredni". Jinak piš obecný název kategorie + instituci.
4. Ceny odhaduj POUZE z cenových koeficientů níže (RŽP dle věku a pojistné částky, nemovitost 0,1 % p.a., domácnost 0,4 % p.a., odpovědnost dle limitu, DPS = vlastní vklad). Nikdy si cenu nevymýšlej.
5. Složení balíčků řiď maticí životních situací níže — najdi situaci klienta (počet dětí, věk, účel, OSVČ) a respektuj priority a balíčková vodítka včetně modifikátorů.
6. Respektuj produkty, které klient UŽ MÁ — nedoporučuj duplicitně; pokud má nevhodný produkt (IŽP, bankovní pojištění schopnosti splácet), navrhni výměnu v "standard" a "luxus".
7. Vše česky, srozumitelně, bez prodejního tlaku. Vždy zmiň, že odhady cen jsou orientační a finální cenu určí pojišťovna/banka.

ETIKA (nikdy neporušuj):
- Nikdy nedoporučuj investiční ani kapitálové životní pojištění jako nový produkt (vysoká nákladovost).
- Nikdy nedoporučuj bankovní pojištění schopnosti splácet — vždy samostatné rizikové ŽP s klesající pojistnou částkou.
- DPS vždy alespoň 1 700 Kč/měs, pokud rozpočet dovolí (státní příspěvek 340 Kč/měs).
- Při napjatém rozpočtu (DSTI > 35 %) doporuč méně produktů, ne menší krytí klíčových rizik.
- Nikdy neraď rušit stávající pojištění před sjednáním náhrady.`;

  const kontext = [
    "=== DATABAZE INSTITUCI ===",
    readData("instituce.json"),
    "=== MATICE ZIVOTNICH SITUACI (priority, parametry kryti, slozeni balicku, modifikatory, etika) ===",
    readData("zivotni_situace.json"),
    "=== CENOVE KOEFICIENTY A SCORING (pojistne_koeficienty, osvc_obory) ===",
    readData("scoring_pravidla.json"),
    "=== VLAJKOVE PRODUKTY POJISTOVEN (povolene obchodni nazvy) ===",
    readData("produkty_vlajkove.json"),
    "=== PENZE (DPS pravidla) ===",
    readData("produkty_penze.json"),
    "=== STAVEBNI SPORENI ===",
    readData("produkty_stavebni_sporeni.json"),
  ].join("\n\n");

  cachedSystemBlocks = [
    { type: "text", text: instrukce },
    {
      type: "text",
      text: kontext,
      // Breakpoint na konci statickeho prefixu — vse nad nim se cachuje.
      cache_control: { type: "ephemeral" },
    },
  ];
  return cachedSystemBlocks;
}

// ---- Validni instituce pro post-validaci ----
let validniInstituceIds: Set<string> | null = null;

function getValidniInstituce(): Set<string> {
  if (validniInstituceIds) return validniInstituceIds;
  const data = JSON.parse(readData("instituce.json")) as Record<string, unknown>;
  const ids = new Set<string>();
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && "id" in item) {
          ids.add(String((item as { id: unknown }).id));
        }
      }
    }
  }
  // Banky z banks.json (hypoteka v balicku odkazuje na banku)
  const banks = JSON.parse(readData("banks.json")) as {
    banky: { id: string }[];
  };
  for (const b of banks.banky) ids.add(b.id);
  validniInstituceIds = ids;
  return ids;
}

export class AIScenarioBuilder {
  private client: Anthropic;
  private model: string;

  constructor() {
    // Konstruktor vyhodi, pokud chybi ANTHROPIC_API_KEY — route to osetri.
    this.client = new Anthropic();
    this.model = process.env.AI_MODEL ?? "claude-opus-4-8";
  }

  static isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  /** Sestavi 3 balicky pro dany vysledek vypoctu. */
  async build(calculation: CalculationResult): Promise<Scenare3> {
    const profil = calculation.profile_echo;

    // Volatilni obsah jde do user message — neinvaliduje cache.
    const userPrompt = [
      "Sestav 3 balíčky pro tohoto klienta.",
      "",
      "=== PROFIL KLIENTA ===",
      JSON.stringify(profil),
      "",
      "=== VYSLEDEK HYPOTECNIHO VYPOCTU (max uver, nejlepsi banky, pouzity prijem) ===",
      JSON.stringify({
        max_loan: calculation.max_loan,
        max_monthly_payment: calculation.max_monthly_payment,
        limiting_factor: calculation.limiting_factor,
        prijem_pouzity_czk: calculation.prijem_pouzity_czk,
        splatky_pouzite_czk: calculation.splatky_pouzite_czk,
        top_banky: calculation.per_bank
          .slice()
          .sort((a, b) => b.max_loan - a.max_loan)
          .slice(0, 3)
          .map((b) => ({
            id: b.bank_id,
            nazev: b.bank_nazev,
            max_loan: b.max_loan,
            splatka: b.max_monthly_payment,
            sazba: b.sazba,
            limit: b.limiting_factor,
          })),
      }),
      "",
      "=== SKORE FINANCNIHO ZDRAVI ===",
      JSON.stringify(calculation.financni_zdravi ?? null),
      "",
      "=== OSVC ANALYZA ===",
      JSON.stringify(calculation.osvc_analyza ?? null),
      "",
      "=== RULE-BASED DOPORUCENI (zaklad pro balicky) ===",
      JSON.stringify(
        calculation.doporuceni.map((d) => ({
          id: d.id,
          kategorie: d.kategorie,
          nadpis: d.nadpis,
          doporucena_castka_czk: d.doporucena_castka_czk,
          odhadovane_pojistne_mesicne_czk: d.odhadovane_pojistne_mesicne_czk,
          navrhovane_instituce: d.navrhovane_instituce,
        })),
      ),
    ].join("\n");

    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: buildSystemBlocks(),
      messages: [{ role: "user", content: userPrompt }],
      output_config: {
        format: zodOutputFormat(Scenare3Schema),
      },
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new Error("AI nevrátila platný strukturovaný výstup.");
    }

    return this.postValidate(parsed as Scenare3);
  }

  /** Ochrana proti halucinaci: nezname instituce_id vynulujeme. */
  private postValidate(result: Scenare3): Scenare3 {
    const validni = getValidniInstituce();
    for (const scenar of result.scenare) {
      for (const produkt of scenar.produkty) {
        if (produkt.instituce_id && !validni.has(produkt.instituce_id)) {
          produkt.instituce_id = "";
        }
      }
    }
    return result;
  }
}
