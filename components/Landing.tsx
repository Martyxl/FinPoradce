"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import OrbScene from "@/components/OrbScene";
import { CHAT_QUERY_KEY } from "@/components/ChatPanel";

// ----------------------------------------------------------------
// Particle field (hero pozadi) — 85 castic, ~14 % menove glyfy,
// spojnice do 145px, devicePixelRatio-aware, rAF smycka.
// ----------------------------------------------------------------
type Castice = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  o: number;
  glyph?: string;
  size: number;
  orange: boolean;
};

function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    // Respektuj prani omezeneho pohybu — nespoustej rAF smycku vubec
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const GLYPHS = ["Kč", "€", "$"];
    let W = 0;
    let H = 0;
    let raf = 0;
    const parts: Castice[] = [];

    function resize() {
      const parent = cv!.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      cv!.width = W * dpr;
      cv!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    for (let i = 0; i < 85; i++) {
      const jeGlyph = Math.random() < 0.14;
      parts.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: 0.6 + Math.random() * 1.7,
        o: jeGlyph ? 0.25 + Math.random() * 0.3 : 0.18 + Math.random() * 0.5,
        glyph: jeGlyph
          ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          : undefined,
        size: 11 + Math.random() * 6,
        orange: jeGlyph ? true : Math.random() < 0.22,
      });
    }

    function frame() {
      const light =
        document.documentElement.getAttribute("data-theme") === "light";
      const base = light ? "#8e97a8" : "#aeb6c2";

      ctx!.clearRect(0, 0, W, H);

      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      }

      // Spojnice
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const dx = parts[i].x - parts[j].x;
          const dy = parts[i].y - parts[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < 145) {
            const t = 1 - dist / 145;
            ctx!.strokeStyle = `rgba(255,122,26,${(t * 0.15).toFixed(3)})`;
            ctx!.beginPath();
            ctx!.moveTo(parts[i].x, parts[i].y);
            ctx!.lineTo(parts[j].x, parts[j].y);
            ctx!.stroke();
          }
        }
      }

      // Castice
      for (const p of parts) {
        ctx!.globalAlpha = p.o;
        if (p.glyph) {
          ctx!.fillStyle = "#ff7a1a";
          ctx!.font = `600 ${p.size}px 'JetBrains Mono', monospace`;
          ctx!.textAlign = "center";
          ctx!.textBaseline = "middle";
          ctx!.fillText(p.glyph, p.x, p.y);
        } else {
          ctx!.fillStyle = p.orange ? "#ff7a1a" : base;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
      ctx!.globalAlpha = 1;

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="ld-canvas" aria-hidden="true" />;
}

// ----------------------------------------------------------------
// Typewriter — rotujici fraze (placeholder) nebo jednorazovy text
// ----------------------------------------------------------------
function useTypewriter(
  phrases: string[],
  opts: { speed?: number; loop?: boolean; startDelay?: number } = {},
) {
  const { speed = 38, loop = true, startDelay = 0 } = opts;
  const [text, setText] = useState("");

  useEffect(() => {
    let phraseIdx = 0;
    let charIdx = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const phrase = phrases[phraseIdx];
      if (!deleting) {
        charIdx++;
        setText(phrase.slice(0, charIdx));
        if (charIdx >= phrase.length) {
          if (!loop) return;
          deleting = true;
          timer = setTimeout(tick, 1600);
          return;
        }
        timer = setTimeout(tick, speed);
      } else {
        charIdx -= 2;
        if (charIdx <= 0) {
          charIdx = 0;
          deleting = false;
          phraseIdx = (phraseIdx + 1) % phrases.length;
        }
        setText(phrases[phraseIdx].slice(0, Math.max(0, charIdx)));
        timer = setTimeout(tick, deleting ? 14 : 300);
      }
    }
    timer = setTimeout(tick, startDelay || speed);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phrases.join("|")]);

  return text;
}

const TYPER_FRAZE = [
  "Chci hypotéku na byt v Brně…",
  "Končí mi fixace — můžu ušetřit?",
  "Kam investovat 5 000 Kč měsíčně?",
  "Jaké pojištění dává smysl pro rodinu?",
];


const CHIPS = [
  {
    label: "Hypotéka 4,2 mil. Kč",
    fill: "Chci hypotéku 4,2 mil. Kč na byt v Brně, mám 800 tis. vlastních.",
  },
  {
    label: "Končí mi fixace",
    fill: "Končí mi fixace hypotéky, banka nabízí 5,79 %. Můžu ušetřit?",
  },
  {
    label: "Investice 5 000 Kč/měs.",
    fill: "Chci investovat 5 000 Kč měsíčně na horizont 15 let.",
  },
  {
    label: "Pojištění pro rodinu",
    fill: "Potřebuji životní pojištění pro rodinu se dvěma dětmi.",
  },
];

// ----------------------------------------------------------------
// Hero AI vstup — vstupni input. Submit jde nahoru do Landing (kvuli
// action orb prechodu).
// ----------------------------------------------------------------
function HeroPanel({ onStart }: { onStart: (q: string) => void }) {
  const [query, setQuery] = useState("");
  const placeholder = useTypewriter(TYPER_FRAZE);

  function submit(q?: string) {
    const dotaz = (q ?? query).trim();
    if (!dotaz) return;
    onStart(dotaz);
  }

  return (
    <>
      <div className="ld-panel">
        <div className="ld-input-row">
          <span className="ld-input-ikona" aria-hidden="true">
            ✦
          </span>
          <div className="ld-input-wrap">
            <input
              className="ld-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              aria-label="Popište svou finanční situaci"
            />
            {query === "" && (
              <span className="ld-typer" aria-hidden="true">
                {placeholder}
                <span className="ld-typer-kurzor" />
              </span>
            )}
          </div>
          <button
            type="button"
            className="ld-cta ld-analyzovat"
            onClick={() => submit()}
          >
            Analyzovat ✦
          </button>
        </div>
      </div>

      <div className="ld-chips">
        {CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="ld-chip"
            onClick={() => submit(chip.fill)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ----------------------------------------------------------------
// Landing page — varianta A (dark-first) + OrbScene big-bang efekt
// ----------------------------------------------------------------
export default function Landing() {
  const router = useRouter();
  // overlay: null | { key, mode } ; revealed: hero progresivni reveal
  const [overlay, setOverlay] = useState<{
    key: number;
    mode: "intro" | "action";
  } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const pendingRef = useRef<string | null>(null);
  const keyRef = useRef(1);
  const motionOkRef = useRef(true);

  // Intro orb na nacteni (jen kdyz neni reduced-motion)
  useEffect(() => {
    const reduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    motionOkRef.current = !reduced;
    if (reduced) {
      setRevealed(true);
      return;
    }
    setOverlay({ key: keyRef.current++, mode: "intro" });
  }, []);

  function navigateToChat(q: string) {
    try {
      sessionStorage.setItem(CHAT_QUERY_KEY, q);
    } catch {}
    router.push("/chat");
  }

  function handleStart(q: string) {
    if (!motionOkRef.current) {
      navigateToChat(q);
      return;
    }
    pendingRef.current = q;
    setOverlay({ key: keyRef.current++, mode: "action" });
  }

  function handleDone(mode: "intro" | "action") {
    setOverlay(null);
    if (mode === "intro") {
      setRevealed(true);
    } else {
      navigateToChat(pendingRef.current ?? "");
    }
  }

  return (
    <div className="ld-page">
      {/* Tmava vrstva od prvniho renderu — drzi obraz tmavy, nez orb prevezme.
          Zmizi po dokonceni intro (revealed). reduced-motion / noscript ji
          schovaji (CSS). */}
      {!revealed && <div className="ld-boot-veil" aria-hidden="true" />}
      {overlay && (
        <OrbScene
          key={overlay.key}
          mode={overlay.mode}
          onReveal={() => setRevealed(true)}
          onDone={handleDone}
        />
      )}
      <a href="#jak" className="skip-link">
        Přeskočit na obsah
      </a>
      {/* Header pres hero */}
      <header className="ld-header">
        <Link href="/" className="ld-logo">
          <span className="fin">Fin</span>
          <span className="sei">Sei</span>
        </Link>
        <nav className="ld-nav">
          <a href="#jak">Jak to funguje</a>
          <a href="#srovnani">Srovnání</a>
          <Link href="/start">Co řeším</Link>
        </nav>
        <ThemeToggle />
        <Link href="/start" className="ld-cta">
          Spustit analýzu
        </Link>
      </header>

      {/* Hero */}
      <section className="ld-hero">
        <ParticleField />

        <aside className="ld-fin-karta vlevo" aria-hidden="true">
          <div className="ld-fin-label">HYPOTÉKA · DNES</div>
          <div className="ld-fin-hodnota oranzova">4,09 % p.a.</div>
          <div className="ld-fin-pozn">nejlepší sazba na trhu</div>
        </aside>
        <aside className="ld-fin-karta vpravo" aria-hidden="true">
          <div className="ld-fin-label">INVESTICE · PORTFOLIO</div>
          <div className="ld-fin-hodnota">+8,2 % ročně</div>
          <div className="ld-mini-bars">
            {[0.25, 0.38, 0.5, 0.62, 0.76, 0.9, 1].map((o, i) => (
              <span
                key={i}
                style={{ height: `${30 + i * 11}%`, opacity: o }}
              />
            ))}
          </div>
        </aside>

        <div className={"ld-hero-inner" + (revealed ? " ld-revealed" : "")}>
          <div className="ld-badge">
            <span className="ld-badge-dot" />
            KONEC PROVIZNÍCH PORADCŮ
          </div>
          <h1 className="ld-h1">
            Finanční sensei, který{" "}
            <span className="akcent">neprodává</span>. Radí.
          </h1>
          <p className="ld-perex">
            AI, která porovná celý trh — hypotéky, pojištění, investice i
            penzi — a navrhne řešení na míru vám. Doporučí jen to, co se
            vyplatí vám. Ne poradci podle provize.
          </p>

          <HeroPanel onStart={handleStart} />

          <div className="ld-trust">
            Bez provizí od bank<span className="sep">✦</span>2 400+ produktů
            z celého trhu<span className="sep">✦</span>Smlouvy podepíšete online
          </div>
        </div>
      </section>

      {/* Ticker */}
      <div className="ld-ticker">
        <span>
          HYPOTÉKY <b>od 4,09 %</b>
        </span>
        <span>
          SPOŘENÍ <b>až 4,6 %</b>
        </span>
        <span>
          INVESTICE <b>+8,2 % p.a.</b>
        </span>
        <span>
          POJIŠTĚNÍ <b>úspora −18 %</b>
        </span>
        <span>
          PENZE <b>+20 % od státu</b>
        </span>
      </div>

      {/* Jak to funguje */}
      <section className="ld-sekce" id="jak">
        <div className="ld-eyebrow">JAK TO FUNGUJE</div>
        <h2 className="ld-h2">Tři kroky k lepším financím</h2>
        <div className="ld-kroky">
          <div className="ld-krok">
            <div className="ld-krok-cislo">01</div>
            <h3>Popište svou situaci</h3>
            <p>
              Žádné formuláře. Napište AI, co řešíte — vlastními slovy, jako
              byste psali kamarádovi.
            </p>
          </div>
          <div className="ld-krok">
            <div className="ld-krok-cislo">02</div>
            <h3>AI porovná celý trh</h3>
            <p>
              Tisíce produktů, aktuální sazby a podmínky. Bez ohledu na to,
              kdo platí provize.
            </p>
          </div>
          <div className="ld-krok">
            <div className="ld-krok-cislo">03</div>
            <h3>Vyberete si — sensei to zařídí</h3>
            <p>
              Z návrhů AI si vyberete sami. Smlouvy, které sensei navrhl, vám
              zprostředkuje zástupce instituce — vy jen podepíšete.
            </p>
          </div>
        </div>
      </section>

      {/* Srovnani */}
      <section className="ld-sekce" id="srovnani">
        <h2 className="ld-h2">Proč ne klasická poradenská síť?</h2>
        <div className="ld-tabulka">
          <div className="ld-tab-head" />
          <div className="ld-tab-head">PORADENSKÁ SÍŤ</div>
          <div className="ld-tab-head ld-tab-finsei">FINSEI</div>

          <div className="ld-tab-label">Odměna poradce</div>
          <div className="ld-tab-ne">
            <span className="znak">✕</span>Skrytá provize od banky či
            pojišťovny
          </div>
          <div className="ld-tab-ano ld-tab-finsei">
            <span className="znak">✓</span>Transparentní — platíte vy a víte
            kolik
          </div>

          <div className="ld-tab-label">Co porovnává</div>
          <div className="ld-tab-ne">
            <span className="znak">✕</span>Jen produkty smluvních partnerů
          </div>
          <div className="ld-tab-ano ld-tab-finsei">
            <span className="znak">✓</span>Celý trh — 2 400+ produktů
          </div>

          <div className="ld-tab-label">Doporučení</div>
          <div className="ld-tab-ne">
            <span className="znak">✕</span>To s nejvyšší provizí
          </div>
          <div className="ld-tab-ano ld-tab-finsei">
            <span className="znak">✓</span>To nejvýhodnější pro vás, doložené
            daty
          </div>

          <div className="ld-tab-label">Rychlost</div>
          <div className="ld-tab-ne">
            <span className="znak">✕</span>Týdny schůzek
          </div>
          <div className="ld-tab-ano ld-tab-finsei">
            <span className="znak">✓</span>Analýza za pár minut
          </div>

          <div className="ld-tab-label">Tlak na podpis</div>
          <div className="ld-tab-ne">
            <span className="znak">✕</span>Telefonáty a urgence
          </div>
          <div className="ld-tab-ano ld-tab-finsei">
            <span className="znak">✓</span>Rozhodujete se sami, kdykoli
          </div>
        </div>
      </section>

      {/* Zaverecne CTA */}
      <section className="ld-final">
        <h2>Přestaňte platit provize, o kterých nevíte.</h2>
        <p>První AI analýza je zdarma a bez závazků.</p>
        <Link href="/start" className="ld-cta">
          Vyzkoušet zdarma
        </Link>
      </section>

      {/* Footer */}
      <footer className="ld-footer">
        <span className="ld-logo">
          <span className="fin">Fin</span>
          <span className="sei">Sei</span>
        </span>
        <span>
          © 2026 · AI finanční poradenství ·{" "}
          <Link href="/podminky" style={{ color: "inherit" }}>
            Podmínky
          </Link>
        </span>
      </footer>
    </div>
  );
}
