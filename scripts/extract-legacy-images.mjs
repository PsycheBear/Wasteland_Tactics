// One-off migration (June 2026 audit, Phase 2): decode the base64 WebP data
// URIs that lived inline in src/data/images.js into real files under
// public/images/legacy/, and rewrite images.js to reference them by URL.
// The IMAGES export keeps the exact same shape, so PortraitImg's fallback
// chain and Game.jsx's UI-image constants work unchanged — the ~174KB of
// image data just stops shipping inside the JS bundle.
//
// Usage: node scripts/extract-legacy-images.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcFile = join(root, 'src', 'data', 'images.js');
const outDir = join(root, 'public', 'images', 'legacy');
mkdirSync(outDir, { recursive: true });

const text = readFileSync(srcFile, 'utf8');

// Parse the literal: top-level keys are either nested star maps
// (`preston: { 1: 'data:...', ... }`) or direct entries (`arena_bg: 'data:...'`).
// Base64 WebP entries are extracted to files; everything else (inline SVG
// placeholders, `${BASE}` PNG paths) is preserved verbatim.
const unitBlockRe = /^ {2}([\w-]+|'[\w-]+'): \{\s*$/;
const starWebpRe = /^ {4}(\d): 'data:image\/webp;base64,([A-Za-z0-9+/=]+)'/;
const starOtherRe = /^ {4}(\d): (.+?),?\s*$/;
const flatWebpRe = /^ {2}([\w-]+): 'data:image\/webp;base64,([A-Za-z0-9+/=]+)'/;
const flatOtherRe = /^ {2}([\w-]+): (.+?),?\s*$/;

const units = new Map(); // key -> Map(star -> { file } | { raw })
const flats = new Map(); // key -> { file } | { raw }
let currentUnit = null;
let written = 0;
let bytes = 0;

for (const line of text.split(/\r?\n/)) {
  const ub = line.match(unitBlockRe);
  if (ub) {
    currentUnit = ub[1].replace(/'/g, '');
    units.set(currentUnit, new Map());
    continue;
  }
  if (/^ {2}\},?\s*$/.test(line)) { currentUnit = null; continue; }

  if (currentUnit) {
    const webp = line.match(starWebpRe);
    if (webp) {
      const file = `${currentUnit}-${webp[1]}.webp`;
      const buf = Buffer.from(webp[2], 'base64');
      writeFileSync(join(outDir, file), buf);
      units.get(currentUnit).set(webp[1], { file });
      written++; bytes += buf.length;
      continue;
    }
    const other = line.match(starOtherRe);
    if (other) units.get(currentUnit).set(other[1], { raw: other[2] });
    continue;
  }

  const fwebp = line.match(flatWebpRe);
  if (fwebp) {
    const file = `${fwebp[1]}.webp`;
    const buf = Buffer.from(fwebp[2], 'base64');
    writeFileSync(join(outDir, file), buf);
    flats.set(fwebp[1], { file });
    written++; bytes += buf.length;
    continue;
  }
  const fother = !/^(import|export|\/\/|};?$|\s*$)/.test(line) && line.match(flatOtherRe);
  if (fother) flats.set(fother[1], { raw: fother[2] });
}

let out = `// Legacy unit/UI image registry.
//
// These started life as inline base64 WebP data URIs; the June 2026 audit
// moved the bytes to public/images/legacy/ (run
// scripts/extract-legacy-images.mjs to regenerate) so they no longer ship
// inside the JS bundle. The IMAGES shape is unchanged: units map
// star tier -> URL, UI elements map key -> URL. New-style per-unit art in
// public/images/units/ (see lib/portraitPath.js) takes precedence; these
// are the fallback tier.

import { BASE } from '../baseUrl.js';

const LEGACY = \`\${BASE}/images/legacy\`;

export const IMAGES = {
`;

for (const [unit, stars] of units) {
  const key = /^[a-z_$][\w$]*$/i.test(unit) ? unit : `'${unit}'`;
  out += `  ${key}: {\n`;
  for (const [star, entry] of stars) {
    out += entry.file
      ? `    ${star}: \`\${LEGACY}/${entry.file}\`,\n`
      : `    ${star}: ${entry.raw},\n`;
  }
  out += `  },\n`;
}
out += `\n  // UI elements\n`;
for (const [key, entry] of flats) {
  out += entry.file
    ? `  ${key}: \`\${LEGACY}/${entry.file}\`,\n`
    : `  ${key}: ${entry.raw},\n`;
}
out += `};\n`;

writeFileSync(srcFile, out);
console.log(`Wrote ${written} webp files (${(bytes / 1024).toFixed(0)} KB) to public/images/legacy/`);
console.log(`Rewrote src/data/images.js (${(out.length / 1024).toFixed(1)} KB, was ${(text.length / 1024).toFixed(1)} KB)`);
