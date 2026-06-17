"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Orb from "@/components/Orb";
import { ORB, type LogoTheme } from "@/lib/brand";

/**
 * FinSei logo systém (viz PROMPT_logo_final.md). Značka = částicový orb
 * (jeden engine `<Orb>`, živý i frozen) + typografické "FS" (Space Grotesk 700,
 * F = barva textu, S = akcent). Žádný geometrický monogram.
 *
 *   <OrbMark />     — orb + "FS" (parametrizovatelný; živý nebo frozen)
 *   <LogoLockup />  — orb mark + wordmark FinSei + tagline (hlavičky)
 *   <PrimaryLogo /> — full-bleed orb + velké "FS" (hero / splash)
 *   <AppIconDark /> — tmavá dlaždice s frozen orbem + "FS" (app ikona)
 *   <OrangeIcon />  — oranžová dlaždice s "FS" (favicon / maskable)
 *   <Wordmark />    — samotný nápis FinSei
 *
 * Bez `theme` propu komponenty sledují živý light/dark režim (data-theme).
 */

/** Čte živý režim z data-theme a reaguje na přepnutí motivu. */
export function useDataTheme(): LogoTheme {
  const [theme, setTheme] = useState<LogoTheme>("dark");
  useEffect(() => {
    const el = document.documentElement;
    const read = () =>
      setTheme(el.getAttribute("data-theme") === "light" ? "light" : "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

type Themed = { theme?: LogoTheme; className?: string; style?: CSSProperties };

// ---- Wordmark ----
export function Wordmark({ theme, size = 26, className, style }: Themed & { size?: number }) {
  const live = useDataTheme();
  const t = ORB[theme ?? live];
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
      <span style={{ color: t.text }}>Fin</span>
      <span style={{ color: t.accent }}>Sei</span>
    </span>
  );
}

// ---- Orb + "FS" ----
export function OrbMark({
  theme,
  size = 96,
  count = 60,
  rFrac = 0.4,
  frozen = false,
  fsScale = 0.46,
  className,
  style,
}: Themed & {
  size?: number;
  count?: number;
  rFrac?: number;
  frozen?: boolean;
  fsScale?: number;
}) {
  const live = useDataTheme();
  const t = ORB[theme ?? live];
  return (
    <span
      className={className}
      style={{ position: "relative", display: "inline-block", width: size, height: size, flex: "0 0 auto", ...style }}
    >
      <Orb
        count={count}
        rFrac={rFrac}
        accent={t.accent}
        accentRGB={t.accentRGB}
        neutral={t.neutral}
        frozen={frozen}
        style={{ position: "absolute", inset: 0 }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-sans)",
          fontWeight: 700,
          fontSize: Math.round(size * fsScale),
          letterSpacing: "-0.04em",
          lineHeight: 1,
          pointerEvents: "none",
        }}
      >
        <span style={{ color: t.text }}>F</span>
        <span style={{ color: t.accent }}>S</span>
      </span>
    </span>
  );
}

// ---- Horizontální lockup: orb + wordmark + tagline (composition #2) ----
export function LogoLockup({
  theme,
  orbSize = 40,
  tagline = true,
  frozen = false,
  className,
  style,
}: Themed & { orbSize?: number; tagline?: boolean; frozen?: boolean }) {
  const live = useDataTheme();
  const th = theme ?? live;
  const t = ORB[th];
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: Math.round(orbSize * 0.3), ...style }}
    >
      <OrbMark theme={th} size={orbSize} count={60} rFrac={0.4} frozen={frozen} />
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: Math.round(orbSize * 0.64),
            letterSpacing: "-0.03em",
          }}
        >
          <span style={{ color: t.text }}>Fin</span>
          <span style={{ color: t.accent }}>Sei</span>
        </span>
        {tagline && (
          <span
            style={{
              marginTop: Math.max(3, Math.round(orbSize * 0.1)),
              fontFamily: "var(--font-mono)",
              fontSize: Math.max(9, Math.round(orbSize * 0.235)),
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: t.sub,
            }}
          >
            Financial&nbsp;Sensei
          </span>
        )}
      </span>
    </span>
  );
}

// ---- Primary live logo: full-bleed orb + velké "FS" (composition #1) ----
export function PrimaryLogo({
  theme,
  size = 320,
  count = 108,
  rFrac = 0.3,
  fsScale = 0.46,
  frozen = false,
  className,
  style,
}: Themed & { size?: number; count?: number; rFrac?: number; fsScale?: number; frozen?: boolean }) {
  return (
    <OrbMark
      theme={theme}
      size={size}
      count={count}
      rFrac={rFrac}
      fsScale={fsScale}
      frozen={frozen}
      className={className}
      style={style}
    />
  );
}

// ---- Static app icon (dark): frozen orb na tmavé dlaždici (composition #3) ----
export function AppIconDark({
  size = 116,
  count = 64,
  rFrac = 0.42,
  className,
  style,
}: {
  size?: number;
  count?: number;
  rFrac?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const t = ORB.dark;
  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: "24%",
        overflow: "hidden",
        background: "radial-gradient(circle at 50% 45%, #1a1206, #0d0f13 74%)",
        ...style,
      }}
    >
      <Orb
        count={count}
        rFrac={rFrac}
        accent={t.accent}
        accentRGB={t.accentRGB}
        neutral={t.neutral}
        frozen
        style={{ position: "absolute", inset: 0 }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-sans)",
          fontWeight: 700,
          fontSize: Math.round(size * 0.46),
          letterSpacing: "-0.04em",
          lineHeight: 1,
          pointerEvents: "none",
        }}
      >
        <span style={{ color: t.text }}>F</span>
        <span style={{ color: t.accent }}>S</span>
      </span>
    </span>
  );
}

// ---- Solid orange icon: "FS" na oranžové dlaždici (composition #4) ----
export function OrangeIcon({
  size = 116,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: "24%",
        background: "#ff7a1a",
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: Math.round(size * 0.4),
        letterSpacing: "-0.04em",
        lineHeight: 1,
        ...style,
      }}
    >
      <span aria-hidden style={{ pointerEvents: "none" }}>
        <span style={{ color: "#181208" }}>F</span>
        <span style={{ color: "#ffffff" }}>S</span>
      </span>
    </span>
  );
}
