// Rasterizuje FinSei „FS" ikonu (oranžová dlaždice, composition #4) do PNG
// favicon dle PROMPT_logo_final.md: 32/52/116/512 + apple-touch-icon (180).
//
// Vektorový favicon (app/icon.svg) funguje ve všech moderních prohlížečích sám;
// tento skript dogeneruje binární PNG pro starší / maskable / Apple kontexty.
//
//   npm i -D sharp
//   npm run gen:favicons
//
// Pozn.: „FS" se sází přes systémové písmo (sharp/resvg). Pro přesné Space
// Grotesk doinstaluj font do systému, jinak se použije bold fallback.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error(
    "Chybí 'sharp'. Spusť:  npm i -D sharp  a poté  npm run gen:favicons",
  );
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FONT =
  "'Space Grotesk','Arial Black','Helvetica Neue',Arial,sans-serif";

// rounded=true → favicon dlaždice (zaoblené rohy); false → apple (iOS zaobluje sám)
const fsTile = (rounded) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" ${rounded ? 'rx="15.36" ry="15.36"' : ""} fill="#ff7a1a"/>
  <text x="32" y="42" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="30" letter-spacing="-1.5"><tspan fill="#181208">F</tspan><tspan fill="#ffffff">S</tspan></text>
</svg>`;

const png = (svg, size) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

const outDir = path.join(ROOT, "public", "logo");
await mkdir(outDir, { recursive: true });

for (const s of [32, 52, 116, 512]) {
  await writeFile(path.join(outDir, `favicon-${s}.png`), await png(fsTile(true), s));
  console.log(`public/logo/favicon-${s}.png`);
}
await writeFile(path.join(ROOT, "app", "apple-icon.png"), await png(fsTile(false), 180));
console.log("app/apple-icon.png");
console.log("Hotovo.");
