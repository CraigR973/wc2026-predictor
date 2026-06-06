/**
 * Generate PWA icons + favicons from the Concept 6 "Calcio C" mark.
 *
 * The mark: a geometric monoline "C" (open centre-circle ring) cradling a
 * football in its mouth, in the brass-gold wordmark gradient on graphite.
 * Evolves the previous "ring + ball" favicon DNA into a deliberate C for
 * **C**alcio (replacing the old **S** for **S**teele).
 *
 * This file is the single source of truth for the mark geometry — it both
 * rasterises the PNGs/ICO and writes the archival vector concepts to
 * docs/logo-concepts/. Edit the geometry here and re-run; everything follows.
 *
 * Outputs to apps/web/public/:
 *   icon-192.png          — standard PWA icon
 *   icon-384.png          — mid-res PWA icon
 *   icon-512.png          — large PWA icon
 *   icon-maskable-512.png — Android adaptive icon (mark inside the safe zone)
 *   apple-touch-icon.png  — 180 × 180, padded, for iOS "Add to Home Screen"
 *   favicon.svg           — vector favicon (flat brass, crisper at 16 px)
 *   favicon.ico           — 32 × 32 fallback, PNG-in-ICO wrapper
 * And to docs/logo-concepts/:
 *   concept-6-calcio-c.svg          — full gradient mark (install-ready)
 *   concept-6-calcio-c-favicon.svg  — flat simplified companion
 *
 * Run with:
 *   node apps/web/generate-icons.mjs
 */

import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '../..');
const out = join(__dir, 'public');
const docs = join(root, 'docs/logo-concepts');

mkdirSync(out, { recursive: true });

const BG = '#0B0E13';
const BRASS = '#D4A24A'; // flat mid-tone for small/flat contexts

// Brass-gold metallic gradient — mirrors --wordmark-gradient (index.css) so the
// mark reads as a matched pair beside the CALCIO wordmark. userSpaceOnUse keeps
// one continuous light source across both the C and the ball, and survives the
// group transforms used by the maskable / apple variants.
const GRAD = `<linearGradient id="calcioGold" gradientUnits="userSpaceOnUse" x1="256" y1="90" x2="256" y2="430">
      <stop offset="0" stop-color="#F0DDA6"/>
      <stop offset="0.55" stop-color="#D4A24A"/>
      <stop offset="1" stop-color="#A77C2A"/>
    </linearGradient>`;

/**
 * The mark, without background. `fill` selects the ink (a gradient url or a
 * flat colour). Geometry is centred in the 512 box: the C ring sits left of
 * centre, the ball nestles in its right-facing mouth, optically balanced.
 *   C ring:  centre (250, 256), radius 148, stroke 60, mouth ±52° on the right
 *   Ball:    centre (380, 256), radius 56, with one knocked-out pentagon panel
 */
function mark(fill) {
  return `<path d="M 341 139 A 148 148 0 1 0 341 373"
        fill="none" stroke="${fill}" stroke-width="60" stroke-linecap="round"/>
  <circle cx="380" cy="256" r="56" fill="${fill}"/>
  <path d="M 380 218 L 348 242 L 360 280 L 400 280 L 412 242 Z" fill="${BG}"/>`;
}

// ── Variants ────────────────────────────────────────────────────────────────
// Full install-ready mark — rounded rect (iOS squircle-ready), gradient ink.
const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Calcio">
  <title>Calcio</title>
  <defs>${GRAD}</defs>
  <rect width="512" height="512" rx="96" ry="96" fill="${BG}"/>
  ${mark('url(#calcioGold)')}
</svg>`;

// Android adaptive icon — full-bleed bg (no corners), mark at 0.9 so every
// point stays inside even the aggressive 72 % crop circle.
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>${GRAD}</defs>
  <rect width="512" height="512" fill="${BG}"/>
  <g transform="translate(256,256) scale(0.9) translate(-256,-256)">
    ${mark('url(#calcioGold)')}
  </g>
</svg>`;

// Apple touch icon — Apple applies its own squircle mask and ignores maskable
// hints, so give it the rounded-rect bg + a comfortable 0.875 padding.
const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>${GRAD}</defs>
  <rect width="512" height="512" rx="96" ry="96" fill="${BG}"/>
  <g transform="translate(256,256) scale(0.875) translate(-256,-256)">
    ${mark('url(#calcioGold)')}
  </g>
</svg>`;

// Favicon — same shape, flat brass (gradients muddy at 16 px). One file, one
// shape from 16 → 512 px, honouring the original concept constraint.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Calcio">
  <title>Calcio — favicon</title>
  <rect width="512" height="512" rx="96" ry="96" fill="${BG}"/>
  ${mark(BRASS)}
</svg>`;

/** Render an SVG string to a PNG Buffer at `size × size`. */
function render(svgStr, size) {
  const resvg = new Resvg(svgStr, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

/** Wrap a PNG buffer in a minimal PNG-in-ICO container (single 32×32 image). */
function pngToIco(pngBuf) {
  const pngLen = pngBuf.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(1, 4); // count: 1 image
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0); // width 32 px
  entry.writeUInt8(32, 1); // height 32 px
  entry.writeUInt8(0, 2); // colour count (0 = no palette)
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngLen, 8); // size of image data
  entry.writeUInt32LE(22, 12); // offset of image data (6 + 16)
  return Buffer.concat([header, entry, pngBuf]);
}

// ── Generate files ──────────────────────────────────────────────────────────
console.log('Generating icon-192.png …');
writeFileSync(join(out, 'icon-192.png'), render(fullSvg, 192));

console.log('Generating icon-384.png …');
writeFileSync(join(out, 'icon-384.png'), render(fullSvg, 384));

console.log('Generating icon-512.png …');
writeFileSync(join(out, 'icon-512.png'), render(fullSvg, 512));

console.log('Generating icon-maskable-512.png …');
writeFileSync(join(out, 'icon-maskable-512.png'), render(maskableSvg, 512));

console.log('Generating apple-touch-icon.png (180 px) …');
writeFileSync(join(out, 'apple-touch-icon.png'), render(appleSvg, 180));

console.log('Generating favicon.svg (flat companion) …');
writeFileSync(join(out, 'favicon.svg'), faviconSvg);

console.log('Generating favicon.ico (32 px PNG-in-ICO) …');
writeFileSync(join(out, 'favicon.ico'), pngToIco(render(faviconSvg, 32)));

// Archival vector concepts (single source of truth lives in this file).
mkdirSync(docs, { recursive: true });
console.log('Writing docs/logo-concepts/concept-6-calcio-c*.svg …');
writeFileSync(join(docs, 'concept-6-calcio-c.svg'), fullSvg);
writeFileSync(join(docs, 'concept-6-calcio-c-favicon.svg'), faviconSvg);

console.log('✓ All Calcio icons written to apps/web/public/');
