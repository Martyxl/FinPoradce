"use client";

import { useState } from "react";
import Link from "next/link";
import type { CalculationResult } from "@/lib/types";

/**
 * Lead handoff — klient si vyzada predani vysledku nezavislemu poradci.
 * Odesila e-mail (povinny) + volitelne kontaktni udaje a souhlas (povinny)
 * na /api/lead, ktery doruci shrnuti poradci pres Resend / webhook.
 */
export default function LeadForm({ result }: { result: CalculationResult }) {
  const [otevreno, setOtevreno] = useState(false);
  const [email, setEmail] = useState("");
  const [jmeno, setJmeno] = useState("");
  const [telefon, setTelefon] = useState("");
  const [poznamka, setPoznamka] = useState("");
  const [souhlas, setSouhlas] = useState(false);
  const [stav, setStav] = useState<"idle" | "odesilam" | "hotovo">("idle");
  const [chyba, setChyba] = useState<string | null>(null);

  async function odeslat() {
    setChyba(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setChyba("Zadejte platnou e-mailovou adresu.");
      return;
    }
    if (!souhlas) {
      setChyba("Pro předání poradci je nutný souhlas se zpracováním údajů.");
      return;
    }
    setStav("odesilam");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          jmeno: jmeno.trim() || undefined,
          telefon: telefon.trim() || undefined,
          poznamka: poznamka.trim() || undefined,
          souhlas,
          vysledek: result,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.detail === "string" ? data.detail : `Chyba ${res.status}`,
        );
      }
      setStav("hotovo");
    } catch (err) {
      setStav("idle");
      setChyba(err instanceof Error ? err.message : "Neznámá chyba.");
    }
  }

  if (stav === "hotovo") {
    return (
      <section className="lead-box lead-hotovo">
        <h2>Hotovo — ozveme se vám</h2>
        <p className="lead">
          Vaše shrnutí jsme předali nezávislému poradci. Spojí se s vámi na{" "}
          <strong>{email}</strong> a probere s vámi konkrétní kroky. Žádný
          prodejní tlak — rozhodujete se sami.
        </p>
      </section>
    );
  }

  return (
    <section className="lead-box">
      <h2>Probrat výsledek s poradcem</h2>
      <p className="lead">
        Chcete to dotáhnout? Nezávislý poradce s vámi projde doporučení a
        papírování s institucemi zařídí za vás. Bez provize od bank — platíte
        jen vy a víte kolik.
      </p>

      {!otevreno ? (
        <button type="button" className="btn" onClick={() => setOtevreno(true)}>
          Chci to probrat s poradcem
        </button>
      ) : (
        <div className="lead-fields">
          <div className="row">
            <div className="field">
              <label htmlFor="lead-email">E-mail *</label>
              <input
                id="lead-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vas@email.cz"
              />
            </div>
            <div className="field">
              <label htmlFor="lead-telefon">Telefon (volitelné)</label>
              <input
                id="lead-telefon"
                type="tel"
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                placeholder="+420…"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="lead-jmeno">Jméno (volitelné)</label>
            <input
              id="lead-jmeno"
              type="text"
              value={jmeno}
              onChange={(e) => setJmeno(e.target.value)}
              placeholder="Jak vás oslovit"
            />
          </div>
          <div className="field">
            <label htmlFor="lead-poznamka">Poznámka (volitelné)</label>
            <input
              id="lead-poznamka"
              type="text"
              value={poznamka}
              onChange={(e) => setPoznamka(e.target.value)}
              placeholder="Kdy se vám hodí volat, na co se zaměřit…"
            />
          </div>

          <label className="lead-souhlas">
            <input
              type="checkbox"
              checked={souhlas}
              onChange={(e) => setSouhlas(e.target.checked)}
            />
            <span>
              Souhlasím, aby mě poradce kontaktoval a zpracoval mé údaje a
              výsledek analýzy za tímto účelem. Podrobnosti v{" "}
              <Link href="/podminky">podmínkách</Link>.
            </span>
          </label>

          {chyba && <div className="error">{chyba}</div>}

          <button
            type="button"
            className="btn"
            onClick={odeslat}
            disabled={stav === "odesilam"}
          >
            {stav === "odesilam" ? "Odesílám…" : "Odeslat poradci"}
          </button>
        </div>
      )}
    </section>
  );
}
