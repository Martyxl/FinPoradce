import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LlmError, extractJson, generateStructured, llmProvider } from "./llm";

const ENV_KEYS = [
  "LLM_PROVIDER",
  "LLM_API_BASE",
  "LLM_API_KEY",
  "LLM_MODEL",
  "LLM_NUM_CTX",
  "ANTHROPIC_API_KEY",
] as const;
const saved: Record<string, string | undefined> = {};

const Schema = z.object({ odpoved: z.string(), skore: z.number() });

function gatewayReply(content: string, status = 200) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 100, completion_tokens: 20 },
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

const call = () =>
  generateStructured({
    schema: Schema,
    system: [{ text: "Jsi FinSei." }, { text: "KONTEXT", cache: true }],
    messages: [{ role: "user", content: "Ahoj" }],
    maxTokens: 500,
  });

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extractJson", () => {
  it("vyloupne JSON z ```json plotů", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("vyloupne JSON z textu okolo", () => {
    expect(extractJson('Tady je výsledek: {"a":{"b":2}} hotovo.')).toBe('{"a":{"b":2}}');
  });
});

describe("llmProvider", () => {
  it("LLM_API_BASE → spark", () => {
    process.env.LLM_API_BASE = "http://spark:4000/v1";
    process.env.ANTHROPIC_API_KEY = "x";
    expect(llmProvider()).toBe("spark");
  });
  it("jen ANTHROPIC_API_KEY → anthropic", () => {
    process.env.ANTHROPIC_API_KEY = "x";
    expect(llmProvider()).toBe("anthropic");
  });
  it("LLM_PROVIDER=anthropic přebije Spark", () => {
    process.env.LLM_API_BASE = "http://spark:4000/v1";
    process.env.ANTHROPIC_API_KEY = "x";
    process.env.LLM_PROVIDER = "anthropic";
    expect(llmProvider()).toBe("anthropic");
  });
  it("nic nastaveno → null a 503", async () => {
    expect(llmProvider()).toBeNull();
    await expect(call()).rejects.toMatchObject({ status: 503 });
  });
});

describe("Spark přes bránu", () => {
  beforeEach(() => {
    process.env.LLM_API_BASE = "http://spark:4000/v1/";
    process.env.LLM_API_KEY = "test-key";
  });

  it("pošle OpenAI-kompatibilní požadavek a vrátí validovaná data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      gatewayReply('```json\n{"odpoved":"OK","skore":7}\n```'),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(call()).resolves.toEqual({ odpoved: "OK", skore: 7 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://spark:4000/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("heavy");
    expect(body.max_tokens).toBe(500);
    expect(body.num_ctx).toBeUndefined();
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("Jsi FinSei.");
    expect(body.messages[0].content).toContain("KONTEXT");
    expect(body.messages[0].content).toContain('"skore"'); // JSON schéma v promptu
    expect(body.messages[1]).toEqual({ role: "user", content: "Ahoj" });
  });

  it("respektuje LLM_MODEL a LLM_NUM_CTX", async () => {
    process.env.LLM_MODEL = "vision";
    process.env.LLM_NUM_CTX = "65536";
    const fetchMock = vi.fn().mockResolvedValue(gatewayReply('{"odpoved":"a","skore":1}'));
    vi.stubGlobal("fetch", fetchMock);
    await call();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("vision");
    expect(body.num_ctx).toBe(65536);
  });

  it("při nevalidním výstupu jednou požádá o opravu", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(gatewayReply('{"odpoved":"chybí skóre"}'))
      .mockResolvedValueOnce(gatewayReply('{"odpoved":"opraveno","skore":3}'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(call()).resolves.toEqual({ odpoved: "opraveno", skore: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryMsgs = JSON.parse(fetchMock.mock.calls[1][1].body).messages;
    expect(retryMsgs.at(-2).role).toBe("assistant");
    expect(retryMsgs.at(-1).content).toContain("skore");
  });

  it("dvakrát nevalidní → LlmError 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => gatewayReply("není to JSON")));
    await expect(call()).rejects.toMatchObject({ name: "LlmError", status: 502 });
  });

  it("odmítnutý klíč → 503", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 401 })));
    await expect(call()).rejects.toThrow(/odmítla klíč/);
  });

  it("LiteLLM bez DB (400 No connected db) → hlásí špatný klíč", async () => {
    const body = '{"error":{"message":"No connected db.","type":"no_db_connection","code":"400"}}';
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 400 })));
    await expect(call()).rejects.toMatchObject({ status: 503, message: expect.stringMatching(/odmítla klíč/) });
  });

  it("jiná chyba brány → 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    await expect(call()).rejects.toMatchObject({ status: 502 });
  });

  it("nedostupná brána → 503", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const err = await call().catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.status).toBe(503);
    expect(err.message).toMatch(/není dostupný/);
  });

  it("chybí LLM_API_KEY → 503 bez volání sítě", async () => {
    delete process.env.LLM_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(call()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
