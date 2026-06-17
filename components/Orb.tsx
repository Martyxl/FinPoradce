"use client";

import { useEffect, useRef } from "react";

/**
 * Orb — jeden znovupoužitelný částicový engine značky FinSei
 * (port `makeOrb` z PROMPT_logo_final.md). Vyplní svůj kontejner `<canvas>`.
 *
 * - Částice na jednotkové sféře (Fibonacci): sy = 1 - i/(N-1)*2,
 *   rad = sqrt(1 - sy²), θ = i*2.399963. Poloměr 0.8–2.1px, ~24 % akcentní.
 * - Každý snímek: rotace kolem Y (angle += 0.005), projekce
 *   rx = bx·cosA + bz·sinA, rz = -bx·sinA + bz·cosA, (cx + rx·R, cy + by·R),
 *   R = min(w,h)·rFrac. Hloubka řídí scale 0.55–1.25× a alfu 0.3–0.9.
 * - Link linky pro páry blíž než R·0.66; radial glow za sférou (R·1.7).
 * - devicePixelRatio-aware, rAF smyčka + resize listener, úklid na unmount.
 * - `frozen` (a prefers-reduced-motion): jediný snímek při angle = 2.1,
 *   smyčka se nespustí. Tím se renderuje statická ikona — je to týž orb.
 */
export default function Orb({
  count = 72,
  rFrac = 0.34,
  accent = "#ff7a1a",
  accentRGB = "255,122,26",
  neutral = "#aeb6c2",
  frozen = false,
  className,
  style,
}: {
  count?: number;
  rFrac?: number;
  accent?: string;
  accentRGB?: string;
  neutral?: string;
  frozen?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const N = count;
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
      R = Math.min(w, h) * rFrac;
    }
    resize();
    window.addEventListener("resize", resize);

    const sx = new Array<number>(N);
    const sy = new Array<number>(N);
    const dep = new Array<number>(N);

    function draw(angle: number) {
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      ctx!.clearRect(0, 0, w, h);

      // radial glow za sférou
      const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, R * 1.7);
      g.addColorStop(0, `rgba(${accentRGB},0.15)`);
      g.addColorStop(0.55, `rgba(${accentRGB},0.05)`);
      g.addColorStop(1, `rgba(${accentRGB},0)`);
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(cx, cy, R * 1.7, 0, 6.2832);
      ctx!.fill();

      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const rx = p.bx * ca + p.bz * sa;
        const rz = -p.bx * sa + p.bz * ca;
        sx[i] = cx + rx * R;
        sy[i] = cy + p.by * R;
        dep[i] = rz;
      }

      const maxD = R * 0.66;
      ctx!.lineWidth = 1;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = sx[i] - sx[j];
          const dy = sy[i] - sy[j];
          const d2 = dx * dx + dy * dy;
          if (d2 < maxD * maxD) {
            const d = Math.sqrt(d2);
            ctx!.strokeStyle = `rgba(${accentRGB},${((1 - d / maxD) * 0.13).toFixed(3)})`;
            ctx!.beginPath();
            ctx!.moveTo(sx[i], sy[i]);
            ctx!.lineTo(sx[j], sy[j]);
            ctx!.stroke();
          }
        }
      }

      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const t = (dep[i] + 1) / 2; // 0..1
        const dscale = 0.55 + t * 0.7; // 0.55–1.25×
        const dalpha = 0.3 + t * 0.6; // 0.3–0.9
        ctx!.globalAlpha = dalpha;
        ctx!.fillStyle = p.orange ? accent : neutral;
        ctx!.beginPath();
        ctx!.arc(sx[i], sy[i], p.r * dscale, 0, 6.2832);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let alive = true;
    if (frozen || reduce) {
      draw(2.1); // jediný statický snímek (frozen ikona)
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
  }, [count, rFrac, accent, accentRGB, neutral, frozen]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    />
  );
}
