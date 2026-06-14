import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { POTREBY } from "@/lib/potreby";

export const metadata: Metadata = {
  title: "FinSei — co řešíte?",
};

export default function StartPage() {
  return (
    <AppShell>
      <h1>S čím vám máme pomoct?</h1>
      <p className="lead">
        Vyberte, co teď řešíte. Připravíme analýzu přesně pro vaši potřebu —
        nezávisle, bez provize od bank.
      </p>

      <div className="potreby-grid">
        {POTREBY.map((p) => (
          <Link key={p.id} href={p.route} className="potreba-karta">
            <span className="potreba-ikona" aria-hidden="true">
              {p.ikona}
            </span>
            <h2>{p.nazev}</h2>
            <div className="potreba-podnadpis">{p.podnadpis}</div>
            <p>{p.popis}</p>
            <span className="potreba-sip" aria-hidden="true">
              Pokračovat →
            </span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
