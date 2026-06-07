import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinPoradce — orientační výpočet hypotéky",
  description:
    "Spočítejte si zdarma a online, na jakou hypotéku dosáhnete u 3 bank. Bez kontaktního formuláře, bez prodejního tlaku.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body>
        <header className="topbar">
          <div className="container">
            <a href="/" className="brand">FinPoradce</a>
            <span className="brand-sub">orientační kalkulačka hypotéky</span>
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
