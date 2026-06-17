/**
 * FinSei brand tokeny pro logo systém (viz PROMPT_logo_final.md).
 * Značka = částicový orb (jeden engine, živý i frozen) + typografické "FS".
 * Hodnoty odpovídají design tokenům v globals.css.
 */

export type LogoTheme = "dark" | "light";

export const ORB = {
  dark: {
    text: "#f2f3f5",
    accent: "#ff7a1a",
    accentRGB: "255,122,26",
    neutral: "#aeb6c2",
    bg: "#0d0f13",
    sub: "#7b818c", // tagline FINANCIAL SENSEI
  },
  light: {
    text: "#16181d",
    accent: "#ee6a0e",
    accentRGB: "238,106,14",
    neutral: "#9aa1ad",
    bg: "#f6f5f2",
    sub: "#8a8f99",
  },
} as const;

/** Kanonická oranžová značky (dlaždice, favicon) — nezávislá na režimu. */
export const BRAND_ORANGE = "#ff7a1a";

export function orbTokens(theme: LogoTheme) {
  return ORB[theme];
}
