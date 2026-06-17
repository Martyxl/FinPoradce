"use client";

import { useEffect, useRef } from "react";
import { BRAND, logoColors, type LogoTheme } from "@/lib/brand";
import { Wordmark } from "@/components/Logo";

/**
 * OrbLogo — živá značka: rotující drátěná sféra částic + typografické "FS"
 * uprostřed (viz PROMPT_logo.md, sekce 4). Port z prototypu `OrbLogo`.
 *
 * - 72 částic na jednotkové sféře (Fibonacci), rotace kolem Y (angle += 0.005)
 * - hloubka řídí velikost (0.55–1.25×) a alfu (0.3–0.9) bodů
 * - link linky mezi blízkými body, oranžový radial glow za sférou
 * - devicePixelRatio-aware, rAF smyčka, resize handler, úklid na unmount
 * - prefers-reduced-motion: jeden statický snímek (bez smyčky)
 *
 * Když `theme` chybí, čte živý režim z data-theme; "FS" pak jede přes CSS proměnné.
 */
export default function OrbLogo({
  theme,
  size = 120,
  className,
  style,
  withWordmark = false,
}: {
  theme?: LogoTheme;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  withWordmark?: boolean;
}) {
  const cvRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const dark = theme
      ? theme === "dark"
      : document.documentElement.getAttribute("data-theme") !== "light";
    const col = dark ? BRAND.dark : BRAND.light;
    const cDot = col.dot;
    const cAccent = col.accent;
    const glow = col.glow;

    const N = 72;
    type P = { bx: number; by: number; bz: number; r: number; orange: boolean };
    const pts: P[] = [];
    for (let i = 0; i < N; i++) {
      const sy = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - sy * sy));
      const th = i * 2.399963; // zlatý úhel
      pts.push({
        bx: Math.cos(th) * rad,
        by: sy,
        bz: Math.sin(th) * rad,
        r: 0.8 + Math.random() * 1.3, // 0.8–2.1px
        orange: Math.random() < 0.24,
      });
    }

    let w = 0,
      h = 0,
      cx = 0,
      cy = 0,
      R = 0;
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = cv!.clientWidth;
      h = cv!.clientHeight;
      cv!.width = Math.max(1, Math.round(w * dpr));
      cv!.height = Math.max(1, Math.round(h * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      cy = h / 2;
      R = Math.min(w, h) * 0.34;
    }
    resize();
    window.addEventListener("resize", resize);

    const sx = new Array<number>(N);
    const syy = new Array<number>(N);
    const dep = new Array<number>(N);

    function draw(angle: number) {
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      ctx!.clearRect(0, 0, w, h);

      // radial glow za sférou
      const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
      g.addColorStop(0, `rgba(${glow},0.15)`);
      g.addColorStop(0.55, `rgba(${glow},0.05)`);
      g.addColorStop(1, `rgba(${glow},0)`);
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(cx, cy, R * 1.6, 0, 6.2832);
      ctx!.fill();

      // projekce
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const rx = p.bx * ca + p.bz * sa;
        const rz = -p.bx * sa + p.bz * ca;
        sx[i] = cx + rx * R;
        syy[i] = cy + p.by * R;
        dep[i] = rz;
      }

      // link linky
      const maxD = R * 0.66;
      ctx!.lineWidth = 1;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = sx[i] - sx[j];
          const dy = syy[i] - syy[j];
          const d2 = dx * dx + dy * dy;
          if (d2 < maxD * maxD) {
            const d = Math.sqrt(d2);
            ctx!.strokeStyle = `rgba(${glow},${((1 - d / maxD) * 0.13).toFixed(3)})`;
            ctx!.beginPath();
            ctx!.moveTo(sx[i], syy[i]);
            ctx!.lineTo(sx[j], syy[j]);
            ctx!.stroke();
          }
        }
      }

      // body (hloubka řídí velikost + alfu)
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const t = (dep[i] + 1) / 2; // 0..1
        const dscale = 0.55 + t * 0.7; // 0.55–1.25×
        const dalpha = 0.3 + t * 0.6; // 0.3–0.9
        ctx!.globalAlpha = dalpha;
        ctx!.fillStyle = p.orange ? cAccent : cDot;
        ctx!.beginPath();
        ctx!.arc(sx[i], syy[i], p.r * dscale, 0, 6.2832);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let alive = true;
    if (reduce) {
      draw(0.6); // jediný statický snímek
    } else {
      let angle = 0;
      const loop = () => {
        if (!alive) return;
        angle += 0.005;
        draw(angle);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [theme, size]);

  const c = logoColors(theme);

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.26), ...style }}
    >
      <span style={{ position: "relative", width: size, height: size, flex: "0 0 auto", display: "inline-block" }}>
        <canvas
          ref={cvRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
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
            fontSize: Math.round(size * 0.34),
            letterSpacing: "-0.03em",
            lineHeight: 1,
            pointerEvents: "none",
          }}
        >
          <span style={{ color: c.text }}>F</span>
          <span style={{ color: c.accent }}>S</span>
        </span>
      </span>
      {withWordmark && <Wordmark theme={theme} size={Math.round(size * 0.32)} />}
    </span>
  );
}
