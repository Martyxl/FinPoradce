import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FinPoradce — orientační výpočet hypotéky",
  description:
    "Spočítejte si zdarma a online, na jakou hypotéku dosáhnete u 10 bank. Bez kontaktního formuláře, bez prodejního tlaku.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body className={inter.className}>
        <header className="topbar">
          <div className="container topbar-inner">
            <a href="/" className="brand">
              <span className="brand-fin">Fin</span>
              <span className="brand-poradce">Poradce</span>
            </a>
            <span className="brand-sub">orientační kalkulačka hypotéky</span>
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
      </body>
    </html>
  );
}
