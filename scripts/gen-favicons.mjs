// Rasterizuje FinSei monogram (oranžová knockout dlaždice) do PNG favicon
// v rozměrech dle PROMPT_logo.md (32/52/116/512) + apple-touch-icon (180).
//
// Vektorový favicon (app/icon.svg) funguje ve všech moderních prohlížečích sám;
// tento skript dogeneruje binární PNG pro starší/Apple kontexty.
//
//   npm i -D sharp
//   npm run gen:favicons
//
// PNG ikony se zapíšou do public/logo/ a app/apple-icon.png (Next je naservíruje
// jako apple-touch-icon automaticky).

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

// rounded=true → favicon dlaždice (zaoblené rohy); false → apple (iOS zaobluje sám)
const tile = (rounded) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" ${rounded ? 'rx="15.36" ry="15.36"' : ""} fill="#ff7a1a"/>
  <g fill="none" stroke="#181208" stroke-width="6.6" stroke-linejoin="miter" stroke-linecap="butt">
    <path d="M33 13 H15 V51 M15 31 H30"/>
    <path d="M50 13 H30 V31 H50 V49 H30"/>
  </g>
</svg>`;

const png = (svg, size) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

const outDir = path.join(ROOT, "public", "logo");
await mkdir(outDir, { recursive: true });

for (const s of [32, 52, 116, 512]) {
  await writeFile(path.join(outDir, `favicon-${s}.png`), await png(tile(true), s));
  console.log(`public/logo/favicon-${s}.png`);
}
await writeFile(path.join(ROOT, "app", "apple-icon.png"), await png(tile(false), 180));
console.log("app/apple-icon.png");
console.log("Hotovo.");
