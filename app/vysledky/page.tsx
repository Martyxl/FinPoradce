"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CalculationResult } from "@/lib/types";
import VysledekKarta from "@/components/VysledekKarta";
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

  return (
    <>
      <h1>Předběžný odhad — porovnání 3 bank</h1>
      <p className="lead">
        Nejvyšší dosažitelný úvěr ve vašem profilu:{" "}
        <strong>{formatCZK(result.max_loan)}</strong> (měsíční splátka{" "}
        <strong>{formatCZK(result.max_monthly_payment)}</strong>).
      </p>

      <div className="warnings">
        <strong>Co tato čísla znamenají:</strong>
        <ul>
          {result.upozorneni.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      </div>

      <div className="bank-grid">
        {result.per_bank.map((b) => (
          <VysledekKarta key={b.bank_id} b={b} />
        ))}
      </div>

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
              return (
                <li key={i}>
                  <strong>{kat?.nazev ?? p.kategorie}</strong>
                  {p.instituce_id && <> · {p.instituce_id}</>}
                  {p.nazev_produktu && <> · {p.nazev_produktu}</>}
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
