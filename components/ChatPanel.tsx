"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatOdpoved, ChatProfil, ChatZprava } from "@/lib/types";

export const CHAT_PROFIL_KEY = "finsei_chat_profil";
export const CHAT_RYCHLY_KEY = "finsei_rychly_profil";

type Potreba = "bydleni" | "zajisteni" | "sporeni";

const POTREBA_CTA: Record<Potreba, string> = {
  bydleni: "Spustit detailní analýzu →",
  zajisteni: "Pokračovat k plánu zajištění →",
  sporeni: "Pokračovat k plánu spoření →",
};

/**
 * Reálný AI chat na landingu (Fáze 11). Z volné konverzace AI rozpozná
 * potřebu (bydlení/zajištění/spoření), extrahuje parametry a když má minimum,
 * nabídne přechod do správného toku s předvyplněnými hodnotami.
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
  const [potreba, setPotreba] = useState<Potreba | null>(null);
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
      if (odp.potreba) setPotreba(odp.potreba);
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
    const cil = potreba ?? "bydleni";
    try {
      if (cil === "bydleni") {
        sessionStorage.setItem(CHAT_PROFIL_KEY, JSON.stringify(profil));
      } else {
        // Zajisteni/sporeni: preved chat profil na rychly profil
        sessionStorage.setItem(
          CHAT_RYCHLY_KEY,
          JSON.stringify({
            typ_prijmu: profil.typ_prijmu,
            cisty_prijem_mesicne: profil.cisty_prijem_mesicne,
            vek: profil.vek,
            pocet_osob_domacnost: profil.pocet_osob_domacnost,
            pocet_deti: profil.pocet_deti,
            osvc_obor: profil.osvc_obor,
            osvc_rocni_obrat_czk: profil.osvc_rocni_obrat_czk,
            cil_text: zpravy.find((z) => z.role === "user")?.text ?? "",
          }),
        );
      }
    } catch {
      /* ignore */
    }
    if (cil === "bydleni") router.push("/kalkulacka");
    else router.push("/potreba/" + cil);
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
          {POTREBA_CTA[potreba ?? "bydleni"]}
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
