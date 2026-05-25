/**
 * Generate PWA icon PNGs from the Concept 4 pitch-as-spreadsheet SVG.
 *
 * Source marks:
 *   concept-4-pitch.svg         → full-detail (≥ 96 px): icon-192/384/512 + apple-touch-icon
 *   concept-4-pitch-favicon.svg → simplified (≤ 64 px):  favicon.svg + favicon.ico
 *
 * Outputs to apps/web/public/:
 *   icon-192.png          — standard PWA icon
 *   icon-384.png          — mid-res PWA icon
 *   icon-512.png          — large PWA icon
 *   icon-maskable-512.png — Android adaptive icon (content inset to 80 % safe zone)
 *   apple-touch-icon.png  — 180 × 180, padded, for iOS "Add to Home Screen"
 *   favicon.svg           — vector favicon (simplified companion)
 *   favicon.ico           — 32 × 32 fallback, PNG-in-ICO wrapper
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
const out  = join(__dir, 'public');

mkdirSync(out, { recursive: true });

const fullSvg    = readFileSync(join(root, 'docs/logo-concepts/concept-4-pitch.svg'), 'utf8');
const faviconSvg = readFileSync(join(root, 'docs/logo-concepts/concept-4-pitch-favicon.svg'), 'utf8');

// ── Maskable variant ──────────────────────────────────────────────────────────
// Android adaptive icons crop to a circle covering ~72 % of the image.
// Safe-zone spec: keep important content in the inner 80 % (409.6 px of 512).
// We remove the rounded corners (full-bleed bg) and scale the pitch to 80 %.
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0B0E13"/>
  <g transform="translate(256,256) scale(0.8) translate(-256,-256)">
    <rect x="68" y="118" width="376" height="276" rx="10" ry="10"
          stroke="#D4A24A" stroke-width="10" fill="none"/>
    <line x1="256" y1="118" x2="256" y2="394" stroke="#D4A24A" stroke-width="10"/>
    <path d="M 68 182 H 142 V 330 H 68"  stroke="#D4A24A" stroke-width="7" fill="none"/>
    <path d="M 444 182 H 370 V 330 H 444" stroke="#D4A24A" stroke-width="7" fill="none"/>
    <circle cx="256" cy="256" r="56" stroke="#D4A24A" stroke-width="10" fill="none"/>
    <g stroke="#D4A24A" stroke-width="3.5" opacity="0.50">
      <line x1="68"  y1="187" x2="444" y2="187"/>
      <line x1="68"  y1="256" x2="444" y2="256"/>
      <line x1="68"  y1="325" x2="444" y2="325"/>
    </g>
    <circle cx="256" cy="256" r="18" fill="#D4A24A"/>
    <path d="M 256 244 L 246 252 L 250 264 L 262 264 L 266 252 Z" fill="#0B0E13"/>
  </g>
</svg>`;

// ── Apple touch icon variant ──────────────────────────────────────────────────
// Apple applies its own squircle mask; it does not honour maskable hints.
// Give it the full-detail mark at 87.5 % scale for comfortable padding.
const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" ry="96" fill="#0B0E13"/>
  <g transform="translate(256,256) scale(0.875) translate(-256,-256)">
    <rect x="68" y="118" width="376" height="276" rx="10" ry="10"
          stroke="#D4A24A" stroke-width="10" fill="none"/>
    <line x1="256" y1="118" x2="256" y2="394" stroke="#D4A24A" stroke-width="10"/>
    <path d="M 68 182 H 142 V 330 H 68"  stroke="#D4A24A" stroke-width="7" fill="none"/>
    <path d="M 444 182 H 370 V 330 H 444" stroke="#D4A24A" stroke-width="7" fill="none"/>
    <circle cx="256" cy="256" r="56" stroke="#D4A24A" stroke-width="10" fill="none"/>
    <g stroke="#D4A24A" stroke-width="3.5" opacity="0.50">
      <line x1="68"  y1="187" x2="444" y2="187"/>
      <line x1="68"  y1="256" x2="444" y2="256"/>
      <line x1="68"  y1="325" x2="444" y2="325"/>
    </g>
    <circle cx="256" cy="256" r="18" fill="#D4A24A"/>
    <path d="M 256 244 L 246 252 L 250 264 L 262 264 L 266 252 Z" fill="#0B0E13"/>
  </g>
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
  entry.writeUInt8(32, 0);           // width 32 px
  entry.writeUInt8(32, 1);           // height 32 px
  entry.writeUInt8(0, 2);            // colour count (0 = no palette)
  entry.writeUInt8(0, 3);            // reserved
  entry.writeUInt16LE(1, 4);         // colour planes
  entry.writeUInt16LE(32, 6);        // bits per pixel
  entry.writeUInt32LE(pngLen, 8);    // size of image data
  entry.writeUInt32LE(22, 12);       // offset of image data (6 + 16)
  return Buffer.concat([header, entry, pngBuf]);
}

// ── Generate files ─────────────────────────────────────────────────────────────

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

console.log('Generating favicon.svg (simplified companion) …');
writeFileSync(join(out, 'favicon.svg'), faviconSvg);

console.log('Generating favicon.ico (32 px PNG-in-ICO) …');
writeFileSync(join(out, 'favicon.ico'), pngToIco(render(faviconSvg, 32)));

console.log('✓ All icons written to apps/web/public/');
