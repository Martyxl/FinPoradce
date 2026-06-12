import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
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
  title: "FinSei — finanční poradce, který neprodává. Radí.",
  description:
    "Jeden nezávislý poradce a AI, která porovná celý trh — hypotéky, pojištění, investice i penzi. Doporučí jen to, co se vyplatí vám. Ne bance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
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
      </body>
    </html>
  );
}
