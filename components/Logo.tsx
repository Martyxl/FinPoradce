import type { CSSProperties } from "react";
import {
  BRAND,
  BRAND_ORANGE,
  CONSTELLATION_SHARED,
  CONSTELLATION_VERTICES,
  MONOGRAM_F,
  MONOGRAM_PATH,
  MONOGRAM_S,
  MONOGRAM_STROKE,
  logoColors,
  type LogoTheme,
} from "@/lib/brand";

/**
 * FinSei logo systém (viz PROMPT_logo.md). Themeable, znovupoužitelné značky.
 * Když `theme` chybí, barvy sledují živý light/dark režim přes CSS proměnné.
 *
 *   <Wordmark />        — textový nápis FinSei (Space Grotesk 700)
 *   <MonogramFS />      — geometrický monogram F+S (app icon / favicon)
 *   <MonogramTile />    — knockout monogram v oranžové dlaždici
 *   <ConstellationFS /> — částicová varianta (nody + linky)
 *   <Logo />            — lockup: monogram + wordmark (pro hlavičky)
 *
 * Živý orb + "FS" je samostatně v <OrbLogo /> (canvas, "use client").
 */

type Base = { theme?: LogoTheme; size?: number; className?: string; style?: CSSProperties };

// ---- 1. Wordmark ----
export function Wordmark({ theme, size = 26, className, style }: Base) {
  const c = logoColors(theme);
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        letterSpacing: "-0.03em",
        fontSize: size,
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span style={{ color: c.text }}>Fin</span>
      <span style={{ color: c.accent }}>Sei</span>
    </span>
  );
}

// ---- 2. Geometrický monogram F+S (primární značka) ----
export function MonogramFS({
  theme,
  size = 64,
  className,
  style,
  title = "FinSei",
}: Base & { title?: string }) {
  const c = logoColors(theme);
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={title}
    >
      <path
        d={MONOGRAM_F}
        style={{ stroke: c.text }}
        strokeWidth={MONOGRAM_STROKE}
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
      <path
        d={MONOGRAM_S}
        style={{ stroke: c.accent }}
        strokeWidth={MONOGRAM_STROKE}
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
    </svg>
  );
}

// ---- 2b. Knockout monogram v oranžové dlaždici (app icon / favicon) ----
export function MonogramTile({
  size = 64,
  radius = 0.24,
  className,
  style,
  title = "FinSei",
}: {
  size?: number;
  radius?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  const r = 64 * radius;
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
    >
      <rect width="64" height="64" rx={r} ry={r} fill={BRAND_ORANGE} />
      <g
        fill="none"
        stroke={BRAND.dark.knockout}
        strokeWidth={MONOGRAM_STROKE}
        strokeLinejoin="miter"
        strokeLinecap="butt"
      >
        <path d={MONOGRAM_F} />
        <path d={MONOGRAM_S} />
      </g>
    </svg>
  );
}

// ---- 3. Souhvězdí (nody + tenké linky) ----
export function ConstellationFS({ theme, size = 64, className, style, title = "FinSei" }: Base & { title?: string }) {
  const c = logoColors(theme);
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={title}
    >
      <path
        d={MONOGRAM_PATH}
        style={{ stroke: c.text }}
        strokeWidth={1.5}
        strokeOpacity={0.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {CONSTELLATION_VERTICES.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} style={{ fill: c.text }} />
      ))}
      <circle cx={CONSTELLATION_SHARED[0]} cy={CONSTELLATION_SHARED[1]} r={2.5} style={{ fill: c.accent }} />
    </svg>
  );
}

// ---- Lockup: monogram + wordmark (pro hlavičky) ----
export function Logo({
  theme,
  size = 26,
  mark = true,
  className,
  style,
}: Base & { mark?: boolean }) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.34), ...style }}
    >
      {mark && <MonogramFS theme={theme} size={Math.round(size * 1.12)} />}
      <Wordmark theme={theme} size={size} />
    </span>
  );
}
