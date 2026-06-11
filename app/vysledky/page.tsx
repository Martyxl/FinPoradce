"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CalculationResult } from "@/lib/types";
import VysledekKarta from "@/components/VysledekKarta";
import DoporuceniKarta from "@/components/DoporuceniKarta";
import { formatCZK } from "@/lib/api";
import { najdiKategorii } from "@/lib/categories";

export default function VysledkyPage() {
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("hypoResult");
    if (raw) {
      try {
        setResult(JSON.parse(raw));
      } catch {
        setResult(null);
      }
    }
    setLoaded(true);
  }, []);

  const stavajiciProdukty = useMemo(
    () => result?.profile_echo.existujici_produkty ?? [],
    [result],
  );

  if (!loaded) return null;

  if (!result) {
    return (
      <>
        <h1>Výsledky nejsou k dispozici</h1>
        <p className="lead">
          Pravděpodobně jste stránku otevřeli přímo. Vraťte se na úvod a
          vyplňte formulář.
        </p>
        <Link href="/" className="btn">Zpět na formulář</Link>
      </>
    );
  }

  const fh = result.financni_zdravi;
  const fhUroven = fh ? fh.uroven.normalize("NFD").replace(/[̀-ͯ]/g, "") : "";
  const osvc = result.osvc_analyza;

  return (
    <>
      <h1>Předběžný odhad — porovnání bank</h1>
      <p className="lead">
        Nejvyšší dosažitelný úvěr ve vašem profilu:{" "}
        <strong>{formatCZK(result.max_loan)}</strong> (měsíční splátka{" "}
        <strong>{formatCZK(result.max_monthly_payment)}</strong>).
      </p>

      {fh && (
        <div className="fh-card">
          <div className={`fh-circle fh-uroven-${fhUroven}`}>
            {fh.skore_0_100}
          </div>
          <div className="fh-info">
            <h2>Finanční zdraví: {fh.uroven}</h2>
            <p className="fh-shrnuti">{fh.shrnuti}</p>
            <div className="fh-dimenze">
              {fh.dimenze.map((d) => {
                const cls =
                  d.skore_0_100 >= 70
                    ? "dobre"
                    : d.skore_0_100 >= 40
                      ? "stredni"
                      : "spatne";
                return (
                  <div key={d.klic} className="fh-dimenze-radek">
                    <span>{d.label}</span>
                    <span className={"fh-dimenze-skore " + cls}>
                      {d.skore_0_100}/100
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="warnings">
        <strong>Co tato čísla znamenají:</strong>
        <ul>
          {result.upozorneni.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      </div>

      {osvc && (
        <section className="osvc-analyza">
          <h2 style={{ marginTop: 0 }}>OSVČ analýza — {osvc.obor_label}</h2>
          <p>
            Roční obrat <strong>{formatCZK(osvc.rocni_obrat_czk)}</strong>{" "}
            přepočítaný 4 metodami, kterými banky hodnotí příjem OSVČ:
          </p>
          <div className="osvc-metody">
            {osvc.metody.map((m) => (
              <div className="osvc-metoda" key={m.nazev}>
                <strong>{m.label}</strong>
                <div className="osvc-prijem">
                  {formatCZK(m.mesicni_prijem_czk)} / měs
                </div>
                <div className="hint" style={{ marginTop: 4 }}>
                  {m.popis}
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: 0 }}>
            <strong>Doporučení:</strong> {osvc.doporuceni}
          </p>
        </section>
      )}

      <h2 style={{ marginTop: 32 }}>Porovnání 10 retailových bank</h2>
      <div className="bank-grid">
        {result.per_bank.map((b) => (
          <VysledekKarta key={b.bank_id} b={b} />
        ))}
      </div>

      {result.doporuceni && result.doporuceni.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <h2>Chytré zajištění v případě neočekávaných událostí</h2>
          <p className="lead">
            Hypotéka je dlouhodobý závazek — vyplatí se mít k ní stavebnice
            ochrany, které drží i bez ní. Doporučení vychází z vašich stávajících
            produktů a jsou seřazena podle priority.
          </p>
          <div className="doporuceni-grid">
            {result.doporuceni.map((d) => (
              <DoporuceniKarta key={d.id} d={d} />
            ))}
          </div>
        </section>
      )}

      {stavajiciProdukty.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2>Vaše stávající produkty ({stavajiciProdukty.length})</h2>
          <p className="lead">
            Shrnutí toho, co máte dnes. Slouží jako podklad pro pozdější
            doporučení, kde máte v zajištění mezery.
          </p>
          <ul className="produkty-prehled">
            {stavajiciProdukty.map((p, i) => {
              const kat = najdiKategorii(p.kategorie);
              const zahrnuje = (p.zahrnuje_kategorie ?? [])
                .map((z) => najdiKategorii(z)?.nazev ?? z)
                .join(", ");
              return (
                <li key={i}>
                  <strong>{kat?.nazev ?? p.kategorie}</strong>
                  {p.instituce_id && <> · {p.instituce_id}</>}
                  {p.nazev_produktu && <> · {p.nazev_produktu}</>}
                  {zahrnuje && (
                    <span className="hint"> (včetně: {zahrnuje})</span>
                  )}
                  <span style={{ float: "right" }}>
                    {formatCZK(p.mesicni_castka_czk)} / měs
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div style={{ marginTop: 24 }}>
        <Link href="/" className="btn secondary">
          Upravit zadání
        </Link>
      </div>
    </>
  );
}
