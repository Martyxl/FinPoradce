/**
 * Společná LLM vrstva FinSei — jeden `generateStructured()` pro všechna AI místa
 * (balíčky /api/scenare, chat /api/chat, analýza potřeb /api/analyza-potreby).
 *
 * Poskytovatelé:
 *  - "spark"     — lokální DGX Spark přes LiteLLM bránu (OpenAI-kompatibilní
 *                  `/chat/completions`), stejný princip jako Tradezer
 *                  news-impact-agent: alias modelu (`heavy` = gpt-oss:120b) řeší
 *                  brána, auth `Bearer LLM_API_KEY`, bereme čistý `content`
 *                  (reasoning vrací brána zvlášť). gpt-oss nemá Anthropic
 *                  structured outputs → JSON schéma posíláme v promptu, výstup
 *                  ořežeme od ```json plotů, validujeme zodem a při chybě
 *                  jednou požádáme o opravu.
 *  - "anthropic" — Claude API (messages.parse + zodOutputFormat + prompt cache),
 *                  záloha / cloud varianta.
 *
 * Výběr: LLM_PROVIDER=spark|anthropic; bez něj automaticky — je-li nastavené
 * LLM_API_BASE → spark, jinak ANTHROPIC_API_KEY → anthropic.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export type LlmProvider = "spark" | "anthropic";
export type LlmMessage = { role: "user" | "assistant"; content: string };
/** Blok system promptu; `cache` = breakpoint prompt cache (jen Anthropic). */
export type SystemBlock = { text: string; cache?: boolean };

/** Chyba s českou hláškou pro uživatele a HTTP statusem pro route. */
export class LlmError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export function llmProvider(): LlmProvider | null {
  const forced = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (forced === "spark") return process.env.LLM_API_BASE ? "spark" : null;
  if (forced === "anthropic") return process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
  if (process.env.LLM_API_BASE) return "spark";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

/** Česká hláška, když není nakonfigurovaný žádný poskytovatel (jinak null). */
export function llmConfigError(): string | null {
  if (llmProvider()) return null;
  return "AI není nakonfigurovaná — nastavte LLM_API_BASE (+ LLM_API_KEY) pro Spark, nebo ANTHROPIC_API_KEY.";
}

type StructuredOpts<S extends z.ZodType> = {
  schema: S;
  system: SystemBlock[];
  messages: LlmMessage[];
  maxTokens: number;
  /** Env proměnná s modelem pro Anthropic (fallback AI_MODEL → default). */
  anthropicModelEnv?: string;
  /** Anthropic output_config.effort (ignorováno u Sparku). */
  effort?: "low" | "high";
};

export async function generateStructured<S extends z.ZodType>(
  opts: StructuredOpts<S>,
): Promise<z.infer<S>> {
  const provider = llmProvider();
  if (provider === "spark") return sparkStructured(opts);
  if (provider === "anthropic") return anthropicStructured(opts);
  throw new LlmError(llmConfigError() ?? "AI není nakonfigurovaná.", 503);
}

// ---------------------------------------------------------------- Spark ----

/** Vyloupne JSON objekt z textu (```json ploty, text kolem). Export kvůli testům. */
export function extractJson(text: string): string {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  if (!t.startsWith("{")) {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a !== -1 && b > a) t = t.slice(a, b + 1);
  }
  return t;
}

function zodIssues(err: z.ZodError): string {
  return err.issues
    .slice(0, 8)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

async function sparkChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
): Promise<string> {
  const base = (process.env.LLM_API_BASE ?? "").replace(/\/+$/, "");
  const key = process.env.LLM_API_KEY;
  if (!key) {
    throw new LlmError(
      "Spark brána vyžaduje klíč — nastavte LLM_API_KEY (master/virtuální klíč LiteLLM).",
      503,
    );
  }
  // gpt-oss:120b: balíčky ~24k tokenů promptu + ~7k výstupu ≈ 215 s (změřeno),
  // takže rezerva i na opravné kolo.
  const timeoutMs = Number(process.env.LLM_TIMEOUT_S ?? 600) * 1000;
  const body: Record<string, unknown> = {
    model: process.env.LLM_MODEL ?? "heavy",
    messages,
    max_tokens: maxTokens,
    temperature: 0.3,
  };
  // Okno kontextu Ollamy (statický kontext balíčků má ~18k tokenů).
  if (process.env.LLM_NUM_CTX) body.num_ctx = Number(process.env.LLM_NUM_CTX);

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new LlmError(
        `Spark nestihl odpovědět do ${Math.round(timeoutMs / 1000)} s — zkuste to znovu.`,
        504,
      );
    }
    throw new LlmError(
      "Spark (lokální AI) není dostupný — zkontrolujte, že běží brána na LLM_API_BASE a server na ni dosáhne.",
      503,
    );
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    console.error("Spark gateway error", res.status, detail);
    // LiteLLM bez DB vrací pro ne-master klíč 400 "No connected db." (virtuální
    // klíče hledá v DB) — v praxi tedy taky „špatný klíč".
    if (
      res.status === 401 ||
      res.status === 403 ||
      /auth|no connected db|invalid.*(key|token)/i.test(detail)
    ) {
      throw new LlmError(
        "Spark brána odmítla klíč (LLM_API_KEY) — použijte master klíč brány.",
        503,
      );
    }
    throw new LlmError(`Spark brána vrátila chybu (${res.status}).`, 502);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  if (data.usage) {
    // Podezřele málo prompt_tokens = Ollama ořízla kontext → zvyšte LLM_NUM_CTX.
    console.info("Spark usage", data.usage);
  }
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

async function sparkStructured<S extends z.ZodType>(
  opts: StructuredOpts<S>,
): Promise<z.infer<S>> {
  const jsonSchema = JSON.stringify(z.toJSONSchema(opts.schema));
  const system =
    opts.system.map((b) => b.text).join("\n\n") +
    "\n\n=== FORMÁT ODPOVĚDI ===\n" +
    "Odpověz POUZE jedním validním JSON objektem (bez markdownu, bez komentářů, " +
    "bez textu okolo), který přesně odpovídá tomuto JSON Schema. Všechna povinná " +
    "pole vyplň; čísla piš jako čísla, ne řetězce.\n" +
    jsonSchema;

  const convo: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
    ...opts.messages,
  ];

  let lastProblem = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await sparkChat(convo, opts.maxTokens);
    if (!raw) {
      lastProblem = "prázdná odpověď (reasoning nejspíš snědl token budget)";
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(extractJson(raw));
      } catch {
        parsed = undefined;
        lastProblem = "odpověď není validní JSON";
      }
      if (parsed !== undefined) {
        const r = opts.schema.safeParse(parsed);
        if (r.success) return r.data;
        lastProblem = zodIssues(r.error);
      }
      // Opravný pokus: ukaž modelu jeho výstup a co je špatně.
      convo.push({ role: "assistant", content: raw.slice(0, 20000) });
    }
    convo.push({
      role: "user",
      content: `Tvá odpověď neodpovídá požadovanému formátu (${lastProblem}). Pošli znovu POUZE opravený JSON objekt podle schématu.`,
    });
  }
  console.error("Spark structured output invalid:", lastProblem);
  throw new LlmError("AI vrátila neplatný výstup — zkuste to prosím znovu.", 502);
}

// ------------------------------------------------------------ Anthropic ----

async function anthropicStructured<S extends z.ZodType>(
  opts: StructuredOpts<S>,
): Promise<z.infer<S>> {
  const model =
    (opts.anthropicModelEnv && process.env[opts.anthropicModelEnv]) ||
    process.env.AI_MODEL ||
    "claude-opus-4-8";
  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model,
      max_tokens: opts.maxTokens,
      system: opts.system.map((b) =>
        b.cache
          ? { type: "text" as const, text: b.text, cache_control: { type: "ephemeral" as const } }
          : { type: "text" as const, text: b.text },
      ),
      messages: opts.messages,
      output_config: {
        format: zodOutputFormat(opts.schema),
        ...(opts.effort ? { effort: opts.effort } : {}),
      },
    });
    const parsed = response.parsed_output;
    if (!parsed) throw new LlmError("AI nevrátila platný výstup.", 502);
    return parsed as z.infer<S>;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if (err instanceof Anthropic.AuthenticationError) {
      throw new LlmError("Neplatný API klíč pro AI službu.", 503);
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new LlmError("AI služba je vytížená — zkuste to za chvíli.", 503);
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic APIError:", err.status, err.message);
      if (err.message.includes("credit balance")) {
        throw new LlmError(
          "AI není aktivní — na účtu Anthropic chybí kredit (Console → Plans & Billing).",
          503,
        );
      }
      throw new LlmError(`AI služba vrátila chybu (${err.status}).`, 502);
    }
    throw err;
  }
}
