"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { OrbMark } from "@/components/Logo";

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
      <a href="#obsah" className="skip-link">
        Přeskočit na obsah
      </a>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand">
            <OrbMark theme="dark" size={26} />
            <span className="brand-fin">Fin</span>
            <span className="brand-sei">Sei</span>
          </Link>
          <span className="brand-sub">nezávislá analýza hypotéky</span>
          <ThemeToggle />
        </div>
      </header>
      <main className="container" id="obsah">
        {children}
      </main>
      <footer className="footer">
        <div className="container">
          <small>
            Výpočty jsou předběžné odhady, ne licencované finanční poradenství.
            Závazné podmínky určí banka po posouzení. Sazby = snapshot jaro
            2026, mění se měsíčně.{" "}
            <Link href="/podminky">Podmínky a ochrana údajů</Link>.
          </small>
        </div>
      </footer>
    </>
  );
}
