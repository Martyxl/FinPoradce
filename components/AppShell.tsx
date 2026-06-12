"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * Shell pro aplikacni stranky (/kalkulacka, /vysledky) — tmava hlavicka
 * s logem FinSei, container a footer. Landing page ma vlastni layout.
 */
export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand">
            <span className="brand-fin">Fin</span>
            <span className="brand-sei">Sei</span>
          </Link>
          <span className="brand-sub">nezávislá analýza hypotéky</span>
          <ThemeToggle />
        </div>
      </header>
      <main className="container">{children}</main>
      <footer className="footer">
        <div className="container">
          <small>
            Výpočty jsou předběžné odhady. Závazné podmínky určí banka po
            posouzení. Sazby = snapshot jaro 2026, mění se měsíčně.
          </small>
        </div>
      </footer>
    </>
  );
}
