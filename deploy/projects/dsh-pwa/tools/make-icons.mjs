// Generate DSH PWA icons (192 / 512 / 512-maskable) from the official DSH whale mark.
// Usage:  npm i sharp && node tools/make-icons.mjs
// The whale <path d="..."> is taken from the DSH frontend's favicon.svg so the icon
// stays identical to the product mark (no re-drawing).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
// OUT defaults to ../icons next to this script; override with DSH_PWA_OUT=<dir>
const OUT = process.env.DSH_PWA_OUT ? process.env.DSH_PWA_OUT : join(HERE, "..", "icons");
const DIST =
  "/opt/lightvela/dsh/releases/0.2.0-rc.2-da8e5035082a-bced78b8/node_modules/.pnpm/" +
  "@deepseek-ai+dsh-web-frontend@0.2.0-rc.2/node_modules/@deepseek-ai/dsh-web-frontend/dist";

// 配色：白底 + 黑鲸鱼（与 DSH 的 favicon.svg 一致）。可用环境变量覆盖：
//   ICON_BG=#4D6BFE ICON_FG=#ffffff node tools/make-icons.mjs   # 蓝底白鲸
const BG = process.env.ICON_BG || "#ffffff";
const FG = process.env.ICON_FG || "#000000";

function whalePath(svg) {
  const m = svg.match(/<path[^>]*\sd="([^"]+)"/);
  if (!m) throw new Error("no <path d=...> found in " + svg.slice(0, 80));
  return m[1];
}

// icon: rounded-square background + whale mark (whale is a 50x50 viewBox, glyph ~49x36 inside it)
function iconSvg(size, glyphRatio, radiusRatio) {
  const d = whalePath(readFileSync(join(DIST, "favicon.svg"), "utf8"));
  const glyph = size * glyphRatio;
  const scale = glyph / 50;
  const off = (size - glyph) / 2;
  const r = Math.round(size * radiusRatio);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BG}"/>
  <g transform="translate(${off} ${off}) scale(${scale})"><path d="${d}" fill="${FG}" fill-rule="nonzero"/></g>
</svg>`;
}

mkdirSync(OUT, { recursive: true });

const jobs = [
  ["icon-192.png", 192, 0.62, 0.22],
  ["icon-512.png", 512, 0.62, 0.22],
  // maskable: full-bleed square (launcher crops it), glyph kept inside the 80% safe zone
  ["icon-512-maskable.png", 512, 0.54, 0],
];

for (const [name, size, glyph, radius] of jobs) {
  const png = await sharp(Buffer.from(iconSvg(size, glyph, radius))).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(OUT, name), png);
  console.log("wrote", name, png.length, "bytes");
}

// favicons served from the same public (gate-exempt) directory as the manifest
for (const f of ["favicon.svg", "favicon-dark.svg"]) {
  copyFileSync(join(DIST, f), join(OUT, f));
  console.log("copied", f);
}
