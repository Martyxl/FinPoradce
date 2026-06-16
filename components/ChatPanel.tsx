"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChatOdpoved, ChatProfil, ChatZprava, PotrebaPlan } from "@/lib/types";
import { formatCZK } from "@/lib/api";

export const CHAT_PROFIL_KEY = "finsei_chat_profil";
export const CHAT_RYCHLY_KEY = "finsei_rychly_profil";
export const CHAT_QUERY_KEY = "finsei_landing_query";

type Potreba = "bydleni" | "zajisteni" | "sporeni";

const POTREBA_CTA: Record<Potreba, string> = {
  bydleni: "Spustit detailní analýzu →",
  zajisteni: "Sestavit plán zajištění ✦",
  sporeni: "Sestavit plán spoření ✦",
};

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
  const [plan, setPlan] = useState<PotrebaPlan | null>(null);
  const [analyzaLoading, setAnalyzaLoading] = useState(false);
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
      const text = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error("Server vrátil neočekávanou odpověď — zkuste to znovu.");
      }
      if (!res.ok) {
        throw new Error(
          typeof data?.detail === "string" ? data.detail : `Chyba ${res.status}`,
        );
      }
      const odp = data as unknown as ChatOdpoved;
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

  useEffect(() => {
    if (odeslanoRef.current) return;
    odeslanoRef.current = true;
    poslat([{ role: "user", text: initialMessage }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [zpravy, loading, plan]);

  function odeslatVstup() {
    const t = vstup.trim();
    if (!t || loading) return;
    const nove: ChatZprava[] = [...zpravy, { role: "user", text: t }];
    setZpravy(nove);
    setVstup("");
    poslat(nove);
  }

  async function spustitAnalyzu() {
    const cil = potreba ?? "bydleni";

    if (cil === "bydleni") {
      try {
        sessionStorage.setItem(CHAT_PROFIL_KEY, JSON.stringify(profil));
      } catch {}
      router.push("/kalkulacka");
      return;
    }

    // Pro zajisteni/sporeni: ukaz analyzu rovnou bez formu
    const cistyPrijem = profil.cisty_prijem_mesicne;
    const vek = profil.vek;

    // Bez zakladnich dat — presmeruj na formular s predvyplnenim
    if (!cistyPrijem || !vek) {
      try {
        sessionStorage.setItem(
          CHAT_RYCHLY_KEY,
          JSON.stringify({
            typ_prijmu: profil.typ_prijmu,
            cisty_prijem_mesicne: cistyPrijem,
            vek,
            pocet_osob_domacnost: profil.pocet_osob_domacnost,
            pocet_deti: profil.pocet_deti,
            osvc_obor: profil.osvc_obor,
            osvc_rocni_obrat_czk: profil.osvc_rocni_obrat_czk,
            cil_text: zpravy.find((z) => z.role === "user")?.text ?? "",
          }),
        );
      } catch {}
      router.push("/potreba/" + cil);
      return;
    }

    setAnalyzaLoading(true);
    setChyba(null);
    try {
      const rychlyProfil = {
        typ_prijmu: profil.typ_prijmu ?? "zamestnanec",
        cisty_prijem_mesicne: cistyPrijem,
        vek,
        pocet_osob_domacnost: profil.pocet_osob_domacnost ?? 1,
        pocet_deti: profil.pocet_deti ?? 0,
        osvc_obor: profil.osvc_obor ?? null,
        osvc_rocni_obrat_czk: profil.osvc_rocni_obrat_czk ?? null,
        cil_text: zpravy.find((z) => z.role === "user")?.text ?? "",
      };
      const res = await fetch("/api/analyza-potreby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ potreba: cil, profil: rychlyProfil }),
      });
      const text = await res.text();
      let d: Record<string, unknown> = {};
      try {
        d = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error("Neplatná odpověď serveru — zkuste to znovu.");
      }
      if (!res.ok) {
        throw new Error(
          typeof d?.detail === "string" ? d.detail : `Chyba ${res.status}`,
        );
      }
      setPlan(d as unknown as PotrebaPlan);
    } catch (err) {
      setChyba(err instanceof Error ? err.message : "Neznámá chyba.");
    } finally {
      setAnalyzaLoading(false);
    }
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

        {/* Inline plán pro zajisteni/sporeni */}
        {plan && potreba !== "bydleni" && (
          <ChatPlan plan={plan} potreba={potreba ?? "zajisteni"} />
        )}
      </div>

      {chyba && <div className="error chat-chyba">{chyba}</div>}

      {analyzaLoading && (
        <div className="chat-analyza-loading">
          <span className="chat-dot" />
          <span className="chat-dot" />
          <span className="chat-dot" />
          <span>SenSei analyzuje vaši situaci…</span>
        </div>
      )}

      {pripraveno && !plan && !analyzaLoading && (
        <button
          type="button"
          className="ld-cta chat-cta"
          onClick={spustitAnalyzu}
        >
          {POTREBA_CTA[potreba ?? "bydleni"]}
        </button>
      )}

      {!plan && (
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
            disabled={loading || analyzaLoading}
          />
          <button
            type="button"
            className="ld-cta"
            onClick={odeslatVstup}
            disabled={loading || analyzaLoading}
            aria-label="Odeslat zprávu"
          >
            ↑
          </button>
        </div>
      )}
    </div>
  );
}

function ChatPlan({
  plan,
  potreba,
}: {
  plan: PotrebaPlan;
  potreba: "zajisteni" | "sporeni";
}) {
  return (
    <div className="chat-plan">
      <div className="chat-plan-badge">✦ Plán od SenSei</div>
      <p className="chat-plan-shrnuti">{plan.shrnuti}</p>

      <div className="chat-plan-kroky">
        {plan.kroky.map((k, i) => (
          <div key={i} className="chat-plan-krok">
            <div className="chat-plan-krok-cislo">{i + 1}</div>
            <div className="chat-plan-krok-obsah">
              <strong>{k.nadpis}</strong>
              <p>{k.popis}</p>
              {k.produkty.length > 0 && (
                <span className="hint">Produkty: {k.produkty.join(", ")}</span>
              )}
              {typeof k.odhad_mesicne_czk === "number" &&
                k.odhad_mesicne_czk > 0 && (
                  <span className="chat-plan-castka">
                    ~{formatCZK(k.odhad_mesicne_czk)} / měs
                  </span>
                )}
            </div>
          </div>
        ))}
      </div>

      {plan.doporucene_produkty.length > 0 && (
        <div className="chat-plan-produkty">
          <h4>Doporučené produkty</h4>
          {plan.doporucene_produkty.map((p, i) => (
            <div key={i} className="chat-plan-produkt">
              <div className="chat-plan-produkt-radek">
                <strong>{p.nazev}</strong>
                <span>{formatCZK(p.mesicni_naklad_czk)} / měs</span>
              </div>
              <span className="hint">{p.proc}</span>
            </div>
          ))}
        </div>
      )}

      {plan.upozorneni.length > 0 && (
        <div className="chat-plan-upozorneni">
          {plan.upozorneni.map((u, i) => (
            <p key={i}>⚠ {u}</p>
          ))}
        </div>
      )}

      <p className="hint" style={{ marginTop: 12 }}>
        Plán je orientační. Finální podmínky určí instituce.
      </p>

      <div className="chat-plan-akce">
        <Link href={"/potreba/" + potreba} className="btn secondary">
          Upřesnit zadání →
        </Link>
        <Link href="/start" className="btn secondary">
          Jiná potřeba
        </Link>
      </div>
    </div>
  );
}
