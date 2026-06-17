/**
 * FinSei brand tokens + logo geometry — jediný zdroj pravdy pro logo systém
 * (viz PROMPT_logo.md). Hodnoty odpovídají design tokenům v globals.css.
 */

export type LogoTheme = "dark" | "light";

export const BRAND = {
  dark: {
    text: "#f2f3f5",
    accent: "#ff7a1a",
    bg: "#0d0f13",
    dot: "#aeb6c2", // neutrální částice v orbu
    glow: "255,122,26", // rgb pro radial glow / link linky
    knockout: "#181208", // strokes uvnitř oranžové dlaždice
  },
  light: {
    text: "#16181d",
    accent: "#ee6a0e",
    bg: "#ffffff",
    dot: "#8e97a8",
    glow: "238,106,14",
    knockout: "#181208",
  },
} as const;

/** Kanonická oranžová značky (dlaždice, favicon) — nezávislá na světlém/tmavém. */
export const BRAND_ORANGE = "#ff7a1a";

// ---- Geometrie monogramu (grid 0 0 64 64) ----
// F a S sdílejí prostřední vrchol (30,31) → čtou se jako jeden propojený celek.
export const MONOGRAM_F = "M33 13 H15 V51 M15 31 H30";
export const MONOGRAM_S = "M50 13 H30 V31 H50 V49 H30";
export const MONOGRAM_PATH = `${MONOGRAM_F} ${MONOGRAM_S}`;
export const MONOGRAM_STROKE = 6.6;

// Vrcholy pro souhvězdí (constellation). Sdílený vrchol (30,31) je akcentní.
export const CONSTELLATION_VERTICES: ReadonlyArray<readonly [number, number]> = [
  [33, 13], [15, 13], [15, 31], [15, 51], // F
  [50, 13], [30, 13], [50, 31], [50, 49], [30, 49], // S
];
export const CONSTELLATION_SHARED: readonly [number, number] = [30, 31];

/**
 * Barvy pro SVG/text značky. Když theme není zadáno, vrátí CSS proměnné, takže
 * logo automaticky sleduje živý light/dark režim stránky.
 */
export function logoColors(theme?: LogoTheme): { text: string; accent: string } {
  if (theme === "dark") return { text: BRAND.dark.text, accent: BRAND.dark.accent };
  if (theme === "light") return { text: BRAND.light.text, accent: BRAND.light.accent };
  return { text: "var(--text-primary)", accent: "var(--brand-orange)" };
}
