"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatOdpoved, ChatProfil, ChatZprava } from "@/lib/types";

export const CHAT_PROFIL_KEY = "finsei_chat_profil";

/**
 * Reálný AI chat na landingu (Fáze 11). Z volné konverzace AI postupně
 * extrahuje parametry hypotéky; když má minimum, nabídne přechod na
 * kalkulačku s předvyplněnými hodnotami.
 */
export default function ChatPanel({
  initialMessage,
}: {
  initialMessage: string;
}) {
  const router = useRouter();
  const [zpravy, setZpravy] = useState<ChatZprava[]>([
    { role: "user", text: initialMessage },
  ]);
  const [profil, setProfil] = useState<ChatProfil>({});
  const [pripraveno, setPripraveno] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vstup, setVstup] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const odeslanoRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function poslat(historie: ChatZprava[]) {
    setLoading(true);
    setChyba(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zpravy: historie }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.detail === "string" ? data.detail : `Chyba ${res.status}`,
        );
      }
      const odp = data as ChatOdpoved;
      setZpravy((z) => [...z, { role: "assistant", text: odp.odpoved }]);
      setProfil((p) => ({ ...p, ...odp.profil }));
      setPripraveno(odp.pripraveno);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : "Neznámá chyba.");
    } finally {
      setLoading(false);
    }
  }

  // Prvni zprava (z hero inputu) — jen jednou
  useEffect(() => {
    if (odeslanoRef.current) return;
    odeslanoRef.current = true;
    poslat([{ role: "user", text: initialMessage }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll dolu
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [zpravy, loading]);

  function odeslatVstup() {
    const t = vstup.trim();
    if (!t || loading) return;
    const nove: ChatZprava[] = [...zpravy, { role: "user", text: t }];
    setZpravy(nove);
    setVstup("");
    poslat(nove);
  }

  function spustitAnalyzu() {
    try {
      sessionStorage.setItem(CHAT_PROFIL_KEY, JSON.stringify(profil));
    } catch {
      /* ignore */
    }
    router.push("/kalkulacka");
  }

  return (
    <div className="chat-panel">
      <div className="chat-okno" ref={scrollRef}>
        {zpravy.map((z, i) => (
          <div key={i} className={"chat-bublina chat-" + z.role}>
            {z.text}
          </div>
        ))}
        {loading && (
          <div className="chat-bublina chat-assistant chat-loading">
            <span className="chat-dot" />
            <span className="chat-dot" />
            <span className="chat-dot" />
          </div>
        )}
      </div>

      {chyba && <div className="error chat-chyba">{chyba}</div>}

      {pripraveno && (
        <button type="button" className="ld-cta chat-cta" onClick={spustitAnalyzu}>
          Spustit detailní analýzu →
        </button>
      )}

      <div className="chat-vstup">
        <input
          type="text"
          value={vstup}
          onChange={(e) => setVstup(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") odeslatVstup();
          }}
          placeholder="Napište odpověď…"
          aria-label="Zpráva do chatu"
          disabled={loading}
        />
        <button
          type="button"
          className="ld-cta"
          onClick={odeslatVstup}
          disabled={loading}
          aria-label="Odeslat zprávu"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
