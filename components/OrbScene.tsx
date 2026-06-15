"use client";

import { useEffect, useRef, useState } from "react";

/**
 * OrbScene — částicový "big bang" orb overlay (handoff design_handoff_finsei_landing).
 * Plný overlay (z-index 9999), který přehraje časovanou sekvenci a pak se odmountuje.
 *
 *   mode="intro"  — jednou na načtení stránky (singularita → výbuch → orb → rozpad
 *                   do ambientního pole; mezitím progresivní reveal hero přes onReveal)
 *   mode="action" — kratší varianta při akci AI (gather → "Analyzuji celý trh" → rozpad)
 *
 * Particle systém: 120 částic na jednotkové sféře (Fibonacci), rotace kolem Y,
 * projekce do 2D, hloubka řídí velikost/alfu. Při disperse orb fyzicky exploduje
 * a přejde do pomalého driftu jako ambientní pole pod overlayem — handoff mezi
 * canvasy maskuje široký rozptyl.
 */
export default function OrbScene({
  mode,
  onReveal,
  onDone,
}: {
  mode: "intro" | "action";
  onReveal?: () => void;
  onDone?: (mode: "intro" | "action") => void;
}) {
  const [phase, setPhase] = useState<"form" | "hold" | "disperse">("form");
  const cvRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  // skip() musí dosáhnout na běžící smyčku — drží se v ref
  const skipRef = useRef<() => void>(() => {});

  useEffect(() => {
    const intro = mode === "intro";
    const dark =
      document.documentElement.getAttribute("data-theme") !== "light";
    const cDot = dark ? "#b6bdc9" : "#8e97a8";
    const cAccent = dark ? "#ff7a1a" : "#ee6a0e";
    const glowRGB = dark ? "255,122,26" : "238,106,14";

    // timeline (ms)
    const tForm = intro ? 1700 : 1150;
    const tHold = intro ? 1450 : 1150;
    const tDisp = intro ? 1900 : 1400;
    const dispStart = tForm + tHold;
    const endAt = dispStart + tDisp;

    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let alive = true;
    let fired = false;
    let angle = 0;
    let start = performance.now();
    let raf = 0;
    let curPhase: "form" | "hold" | "disperse" | null = null;

    const N = 120;
    const GLYPHS = ["Kč", "€", "$"];
    let w = 0,
      h = 0,
      cx = 0,
      cy = 0,
      R = 0;

    type P = {
      bx: number; by: number; bz: number;
      r: number; glyph: string | null; fs: number; orange: boolean;
      x: number; y: number; vx: number; vy: number;
      av: number; aw: number; depth: number;
    };

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      w = cv!.clientWidth;
      h = cv!.clientHeight;
      cv!.width = Math.max(1, w * dpr);
      cv!.height = Math.max(1, h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = w / 2;
      cy = h * 0.43;
      R = Math.min(w, h) * 0.28;
    }
    resize();
    window.addEventListener("resize", resize);

    const pts: P[] = [];
    for (let i = 0; i < N; i++) {
      const sy = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - sy * sy));
      const th = i * 2.399963;
      const glyph = Math.random() < 0.12 ? GLYPHS[i % 3] : null;
      const p: P = {
        bx: Math.cos(th) * rad,
        by: sy,
        bz: Math.sin(th) * rad,
        r: Math.random() * 1.5 + 0.9,
        glyph,
        fs: Math.round(Math.random() * 5 + 11),
        orange: !!glyph || Math.random() < 0.24,
        x: 0, y: 0, vx: 0, vy: 0, av: 0, aw: 0, depth: 0,
      };
      if (intro) {
        // big bang: start v singularite, vystrel ven
        p.x = cx + (Math.random() - 0.5) * 6;
        p.y = cy + (Math.random() - 0.5) * 6;
        const a = Math.random() * 6.2832;
        const sp = Math.random() * 9 + 4;
        p.vx = Math.cos(a) * sp;
        p.vy = Math.sin(a) * sp;
      } else {
        // gather: start rozptyleny po viewportu
        p.x = Math.random() * w;
        p.y = Math.random() * h;
      }
      pts.push(p);
    }

    function setBurst() {
      for (const p of pts) {
        let dx = p.x - cx;
        let dy = p.y - cy;
        const m = Math.hypot(dx, dy) || 1;
        dx /= m;
        dy /= m;
        const sp = 13 + Math.random() * 11;
        p.vx = dx * sp;
        p.vy = dy * sp;
        p.av = (Math.random() - 0.5) * 0.55;
        p.aw = (Math.random() - 0.5) * 0.55;
      }
    }

    function tick() {
      if (!alive) return;
      const e = performance.now() - start;

      let ph: "form" | "hold" | "disperse";
      if (e < tForm) ph = "form";
      else if (e < dispStart) ph = "hold";
      else ph = "disperse";
      if (ph !== curPhase) {
        curPhase = ph;
        setPhase(ph);
        if (ph === "disperse") {
          setBurst();
          if (intro && onReveal) onReveal();
        }
      }

      angle += ph === "form" ? 0.002 : 0.006;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);

      let spring: number;
      let damp: number;
      if (ph === "form") {
        spring = intro ? 0.055 : 0.05;
        damp = intro ? 0.9 : 0.86;
      } else {
        spring = 0.09;
        damp = 0.78;
      }

      let glowEnv: number;
      let pAlpha: number;
      if (ph === "form") {
        glowEnv = Math.min(1, e / tForm);
        pAlpha = glowEnv;
      } else if (ph === "hold") {
        glowEnv = 1;
        pAlpha = 1;
      } else {
        glowEnv = Math.max(0, 1 - (e - dispStart) / tDisp);
        pAlpha = 1;
      }
      if (bgRef.current) bgRef.current.style.opacity = String(glowEnv);

      ctx!.clearRect(0, 0, w, h);

      if (glowEnv > 0.01) {
        const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
        g.addColorStop(0, `rgba(${glowRGB},${(0.22 * glowEnv).toFixed(3)})`);
        g.addColorStop(0.5, `rgba(${glowRGB},${(0.07 * glowEnv).toFixed(3)})`);
        g.addColorStop(1, `rgba(${glowRGB},0)`);
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(cx, cy, R * 1.5, 0, 6.2832);
        ctx!.fill();
      }

      for (const p of pts) {
        const rx = p.bx * ca + p.bz * sa;
        const rz = -p.bx * sa + p.bz * ca;
        p.depth = rz;
        if (ph === "disperse") {
          p.vx += (p.av - p.vx) * 0.035;
          p.vy += (p.aw - p.vy) * 0.035;
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.av); }
          else if (p.x > w) { p.x = w; p.vx = -Math.abs(p.av); }
          if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.aw); }
          else if (p.y > h) { p.y = h; p.vy = -Math.abs(p.aw); }
        } else {
          const tx = cx + rx * R;
          const ty = cy + p.by * R;
          p.vx += (tx - p.x) * spring;
          p.vy += (ty - p.y) * spring;
          p.vx *= damp;
          p.vy *= damp;
          p.x += p.vx;
          p.y += p.vy;
        }
      }

      const linkDist = ph === "disperse" ? 145 : R * 0.62;
      ctx!.lineWidth = 1;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = pts[i];
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDist * linkDist) {
            const t = 1 - Math.sqrt(d2) / linkDist;
            ctx!.strokeStyle = `rgba(${glowRGB},${(t * 0.15 * pAlpha).toFixed(3)})`;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      for (const p of pts) {
        const dscale = 0.55 + ((p.depth + 1) / 2) * 0.75;
        const dalpha = (0.35 + ((p.depth + 1) / 2) * 0.65) * pAlpha;
        ctx!.globalAlpha = Math.max(0, Math.min(1, dalpha));
        ctx!.fillStyle = p.orange ? cAccent : cDot;
        if (p.glyph) {
          ctx!.font = `600 ${(p.fs * dscale).toFixed(1)}px "JetBrains Mono", monospace`;
          ctx!.textAlign = "center";
          ctx!.textBaseline = "middle";
          ctx!.fillText(p.glyph, p.x, p.y);
        } else {
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r * dscale, 0, 6.2832);
          ctx!.fill();
        }
      }
      ctx!.globalAlpha = 1;

      if (!fired && e >= endAt) {
        fired = true;
        if (onDone) onDone(mode);
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    // skip (jen intro): skok rovnou na disperse
    skipRef.current = () => {
      if (curPhase === "disperse") return;
      start = performance.now() - dispStart;
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const intro = mode === "intro";
  const dark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "light"
      ? false
      : true;
  const accent = dark ? "#ff7a1a" : "#ee6a0e";
  const finColor = dark ? "#f2f3f5" : "#16181d";
  const subColor = dark ? "#7b818c" : "#8a8f99";
  const actMain = dark ? "#cfd3da" : "#3a3f48";
  const actSub = dark ? "#6b7280" : "#8a8f99";
  const hintColor = dark ? "#565c66" : "#9298a3";
  const hold = phase === "hold";

  const labelStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    top: "63%",
    textAlign: "center",
    opacity: hold ? 1 : 0,
    transition: "opacity .6s ease",
    transform: hold ? "translateY(0)" : "translateY(8px)",
    pointerEvents: "none",
  };

  return (
    <div
      onClick={intro ? () => skipRef.current() : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        overflow: "hidden",
        cursor: intro ? "pointer" : "default",
      }}
    >
      <div
        ref={bgRef}
        style={{
          position: "absolute",
          inset: 0,
          background: intro
            ? dark
              ? "#08090c"
              : "#f6f5f2"
            : dark
              ? "rgba(8,9,12,0.92)"
              : "rgba(246,245,242,0.92)",
          backdropFilter: intro ? "none" : "blur(8px)",
          WebkitBackdropFilter: intro ? "none" : "blur(8px)",
        }}
      />
      <canvas
        ref={cvRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
      <div style={labelStyle}>
        {intro ? (
          <>
            <div
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "58px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              <span style={{ color: finColor }}>Fin</span>
              <span style={{ color: accent }}>Sei</span>
            </div>
            <div
              style={{
                marginTop: "14px",
                fontFamily: "var(--font-mono)",
                fontSize: "12.5px",
                letterSpacing: "0.34em",
                color: subColor,
                textTransform: "uppercase",
              }}
            >
              Financial&nbsp;Sensei
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                letterSpacing: "0.22em",
                color: actMain,
                textTransform: "uppercase",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: accent,
                  display: "inline-block",
                  animation: "pulseDot 0.9s infinite",
                }}
              />
              Analyzuji&nbsp;celý&nbsp;trh
            </div>
            <div
              style={{
                marginTop: "10px",
                fontFamily: "var(--font-mono)",
                fontSize: "11.5px",
                letterSpacing: "0.1em",
                color: actSub,
              }}
            >
              2&nbsp;400+&nbsp;produktů · 46&nbsp;institucí
            </div>
          </>
        )}
      </div>
      {intro && (
        <div
          onClick={() => skipRef.current()}
          style={{
            position: "absolute",
            bottom: "40px",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.18em",
            color: hintColor,
            textTransform: "uppercase",
            cursor: "pointer",
            opacity: hold ? 1 : 0,
            transition: "opacity .6s ease",
            pointerEvents: "auto",
          }}
        >
          Klikněte pro vstup →
        </div>
      )}
    </div>
  );
}
