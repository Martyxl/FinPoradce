/**
 * POST JSON na naše API a vrať data. Srozumitelné české chyby i pro odpovědi,
 * které nejsou JSON — typicky timeout serverless funkce (Vercel vrátí 504
 * s textovou stránkou), kde dřív UI hlásilo jen „neočekávanou odpověď".
 */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "Nepodařilo se spojit se serverem — zkontrolujte připojení a zkuste to znovu.",
    );
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    if (res.status === 504 || /timeout|timed out/i.test(text)) {
      throw new Error(
        "AI nestihla odpovědět v časovém limitu serveru — zkuste to za chvíli znovu.",
      );
    }
    throw new Error(
      `Server vrátil neočekávanou odpověď (HTTP ${res.status}) — zkuste to znovu.`,
    );
  }

  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new Error(typeof detail === "string" ? detail : `Chyba ${res.status}`);
  }
  return data as T;
}
