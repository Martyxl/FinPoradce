"use client";

import type { BankResult } from "@/lib/types";
import { formatCZK, formatPct } from "@/lib/api";

const LIMIT_LABEL: Record<string, string> = {
  LTV: "LTV (zástavní hodnota)",
  DSTI: "DSTI (poměr splátky k příjmu)",
  DTI: "DTI (poměr dluhu k ročnímu příjmu)",
  ZADOST: "Velikost požadovaného úvěru",
};

export default function VysledekKarta({ b }: { b: BankResult }) {
  return (
    <div className="bank-card">
      <h3>{b.bank_nazev}</h3>

      <div className="metric">
        <div className="label">Maximální úvěr (odhad)</div>
        <div className="value">{formatCZK(b.max_loan)}</div>
      </div>

      <div className="metric">
        <div className="label">Měsíční splátka</div>
        <div className="value small">
          {formatCZK(b.max_monthly_payment)}
        </div>
      </div>

      <div className="metric">
        <div className="label">Sazba (fixace dle volby)</div>
        <div className="value small">
          {formatPct(b.sazba, 2)}{" "}
          {b.sazba_puvod === "estimate" && (
            <span className="tag">odhad</span>
          )}
        </div>
      </div>

      <div className="metric">
        <div className="label">Limitující faktor</div>
        <span className="tag limit">
          {LIMIT_LABEL[b.limiting_factor] ?? b.limiting_factor}
        </span>
      </div>

      <div className="metric">
        <div className="label">Použité LTV</div>
        <div className="value small">{formatPct(b.ltv_pouzite, 1)}</div>
      </div>

      {b.is_estimate && (
        <div className="estimate">
          Některé hodnoty (interní limity / sazba) jsou odhady a v ostrém provozu
          je potřeba je ověřit u banky.
        </div>
      )}

      <div className="notes">
        <strong>Podmínky pro nejlepší sazbu:</strong>
        <div>{b.podminky_slev || "—"}</div>
        {b.poznamky.length > 0 && (
          <>
            <strong>Poznámky:</strong>
            <ul>
              {b.poznamky.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
