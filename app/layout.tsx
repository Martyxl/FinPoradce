import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import CookieLista from "@/components/CookieLista";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-space-grotesk",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "FinSei — finanční sensei, který neprodává. Radí.",
  description:
    "AI finanční sensei, který porovná celý trh — hypotéky, pojištění, investice i penzi — a navrhne řešení na míru vám. Doporučí jen to, co se vyplatí vám. Ne poradci podle provize.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <head>
        {/* Bez JS: orb intro nepobezi — schovej boot veil a ukaz hero obsah,
            jinak by stranka zustala tmava (veil je v SSR HTML). */}
        <noscript>
          <style>{`.ld-boot-veil{display:none!important}.ld-hero-inner>*{opacity:1!important}`}</style>
        </noscript>
      </head>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
        style={{
          // next/font vystavi promenne s vlastnimi nazvy — preposleme je
          // do tokenu design systemu
          ["--font-sans" as string]: "var(--font-space-grotesk)",
          ["--font-mono" as string]: "var(--font-jetbrains-mono)",
        }}
      >
        {children}
        <CookieLista />
      </body>
    </html>
  );
}
