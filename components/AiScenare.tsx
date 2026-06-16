"use client";

import { useState } from "react";
import type { CalculationResult, Scenar, Scenare3 } from "@/lib/types";
import { formatCZK } from "@/lib/api";

const UROVEN_META: Record<
  Scenar["uroven"],
  { label: string; cssClass: string }
> = {
  nejlevnejsi: { label: "Nejlevnější", cssClass: "scenar-nejlevnejsi" },
  standard: { label: "Standard", cssClass: "scenar-standard" },
  luxus: { label: "Luxus", cssClass: "scenar-luxus" },
};

export default function AiScenare({ result }: { result: CalculationResult }) {
  const [scenare, setScenare] = useState<Scenare3 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function nacti() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scenare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
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
          typeof data?.detail === "string"
            ? data.detail
            : `Chyba ${res.status}`,
        );
      }
      setScenare(data as unknown as Scenare3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznámá chyba.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ marginTop: 40 }}>
      <h2>AI doporučené balíčky</h2>
      <p className="lead">
        Nezávislé AI porovná vaši situaci s celou produktovou databází a
        sestaví 3 varianty řešení — od nejlevnější po kompletní zajištění.
        Můžete je porovnat s doporučeními výše.
      </p>

      {!scenare && (
        <button
          type="button"
          className="btn"
          onClick={nacti}
          disabled={loading}
        >
          {loading ? "AI analyzuje vaši situaci…" : "Co doporučuje AI?"}
        </button>
      )}

      {loading && (
        <p className="hint" style={{ marginTop: 8 }}>
          Obvykle to trvá 10–30 sekund. Sestavujeme balíčky přesně pro vaši
          domácnost.
        </p>
      )}

      {error && (
        <div className="error" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}

      {scenare && (
        <>
          <div className="scenare-grid">
            {scenare.scenare.map((s) => (
              <ScenarKarta key={s.uroven} s={s} />
            ))}
          </div>
          <div className="scenare-komentar">
            <strong>Shrnutí AI:</strong> {scenare.celkovy_komentar}
          </div>

          {scenare.chytre_strategie && scenare.chytre_strategie.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <h3 style={{ margin: "0 0 4px" }}>
                Chytré strategie pro vaši situaci
              </h3>
              <p className="hint" style={{ marginBottom: 12 }}>
                Pokročilé kombinace hypotéky, investic a hodnoty nemovitosti —
                orientační modelování, ne investiční doporučení.
              </p>
              <div className="strategie-grid">
                {scenare.chytre_strategie.map((st, i) => (
                  <article key={i} className="strategie-karta">
                    <h4>{st.nazev}</h4>
                    <p className="strategie-popis">{st.popis}</p>
                    <div className="strategie-cisla">{st.cisla}</div>
                    <ul className="strategie-rizika">
                      {st.rizika.map((r, j) => (
                        <li key={j}>⚠ {r}</li>
                      ))}
                    </ul>
                    <div className="strategie-doporuceni">
                      {st.doporuceni}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
          <p className="hint" style={{ marginTop: 10 }}>
            Odhady cen jsou orientační (estimate) — finální cenu určí
            pojišťovna nebo banka po posouzení. AI doporučení nenahrazuje
            licencované finanční poradenství.
          </p>
        </>
      )}
    </section>
  );
}

function ScenarKarta({ s }: { s: Scenar }) {
  const meta = UROVEN_META[s.uroven] ?? UROVEN_META.standard;
  return (
    <article className={"scenar-karta " + meta.cssClass}>
      <header className="scenar-header">
        <span className="scenar-tag">{meta.label}</span>
        <h3>{s.nadpis}</h3>
        <div className="scenar-cena">
          {formatCZK(s.mesicni_naklad_celkem_czk)}
          <span className="scenar-cena-mes"> / měs celkem</span>
        </div>
        <p className="scenar-filozofie">{s.filozofie}</p>
      </header>

      <ul className="scenar-produkty">
        {s.produkty.map((p, i) => (
          <li key={i}>
            <div className="scenar-produkt-radek">
              <strong>{p.nazev}</strong>
              <span>{formatCZK(p.mesicni_naklad_czk)}/měs</span>
            </div>
            <span className="hint">{p.proc}</span>
          </li>
        ))}
      </ul>

      <div className="scenar-klady-zapory">
        <ul className="scenar-klady">
          {s.klady.map((k, i) => (
            <li key={i}>+ {k}</li>
          ))}
        </ul>
        <ul className="scenar-zapory">
          {s.zapory.map((z, i) => (
            <li key={i}>− {z}</li>
          ))}
        </ul>
      </div>

      <div className="scenar-vhodnost">{s.vhodnost_pro_klienta}</div>
    </article>
  );
}
