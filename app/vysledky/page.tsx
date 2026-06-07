"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CalculationResult } from "@/lib/types";
import VysledekKarta from "@/components/VysledekKarta";
import { formatCZK } from "@/lib/api";

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

      <div style={{ marginTop: 24 }}>
        <Link href="/" className="btn secondary">
          Upravit zadání
        </Link>
      </div>
    </>
  );
}
