"use client";

import type { Doporuceni } from "@/lib/types";
import { formatCZK } from "@/lib/api";

const KATEGORIE_META: Record<
  Doporuceni["kategorie"],
  { label: string; cssClass: string }
> = {
  CHYBI: { label: "Chybí", cssClass: "doporuceni-chybi" },
  NEOPTIMALNI: { label: "Lze vylepšit", cssClass: "doporuceni-neoptimalni" },
  UPOZORNENI: { label: "Upozornění", cssClass: "doporuceni-upozorneni" },
  OK: { label: "V pořádku", cssClass: "doporuceni-ok" },
};

export default function DoporuceniKarta({ d }: { d: Doporuceni }) {
  const meta = KATEGORIE_META[d.kategorie];
  return (
    <article className={"doporuceni-karta " + meta.cssClass}>
      <header className="doporuceni-header">
        <span className="doporuceni-tag">{meta.label}</span>
        <h3>{d.nadpis}</h3>
      </header>
      <p className="doporuceni-popis">{d.popis}</p>

      {d.proc.length > 0 && (
        <>
          <strong className="doporuceni-podnadpis">Proč:</strong>
          <ul className="doporuceni-proc">
            {d.proc.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </>
      )}

      {d.doporucena_akce && (
        <div className="doporuceni-akce">
          <strong>Doporučujeme:</strong> {d.doporucena_akce}
        </div>
      )}

      {typeof d.doporucena_castka_czk === "number" &&
        d.doporucena_castka_czk > 0 && (
          <div className="doporuceni-castka">
            Orientační částka:{" "}
            <strong>{formatCZK(d.doporucena_castka_czk)}</strong>
          </div>
        )}

      {typeof d.odhadovane_pojistne_mesicne_czk === "number" &&
        d.odhadovane_pojistne_mesicne_czk > 0 && (
          <div className="doporuceni-pojistne">
            Odhad měsíčního pojistného:{" "}
            <strong>{formatCZK(d.odhadovane_pojistne_mesicne_czk)}</strong>
            {" "}
            <small>(orientační, ESTIMATE)</small>
          </div>
        )}

      {d.uspora_popis && (
        <div className="doporuceni-uspora">
          {typeof d.uspora_mesicne_czk === "number" && d.uspora_mesicne_czk > 0 ? (
            <>
              <strong>Úspora {formatCZK(d.uspora_mesicne_czk)} / měs.</strong>{" "}
            </>
          ) : null}
          {d.uspora_popis}
        </div>
      )}

      {d.navrhovane_instituce && d.navrhovane_instituce.length > 0 && (
        <div className="doporuceni-instituce">
          <strong>Doporučené instituce:</strong>
          <ul>
            {d.navrhovane_instituce.map((i) => (
              <li key={i.id}>
                {i.nazev}
                {i.duvod && <span className="hint"> — {i.duvod}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
