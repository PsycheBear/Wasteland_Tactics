/**
 * Generates placeholder SVG icons for all game icons (bosses, items, traits, augments).
 * Each SVG is a themed icon with colors matching the category.
 * Run: node scripts/generate-icon-placeholders.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'images', 'icons');
fs.mkdirSync(outDir, { recursive: true });

function makeSvg(label, bgColor, fgColor, shape = 'circle') {
  const bg = shape === 'circle'
    ? `<circle cx="32" cy="32" r="30" fill="${bgColor}" stroke="${fgColor}" stroke-width="2"/>`
    : shape === 'hex'
    ? `<polygon points="32,2 58,17 58,47 32,62 6,47 6,17" fill="${bgColor}" stroke="${fgColor}" stroke-width="2"/>`
    : shape === 'diamond'
    ? `<polygon points="32,2 62,32 32,62 2,32" fill="${bgColor}" stroke="${fgColor}" stroke-width="2"/>`
    : `<rect x="2" y="2" width="60" height="60" rx="8" fill="${bgColor}" stroke="${fgColor}" stroke-width="2"/>`;

  // Truncate label to fit
  const displayLabel = label.length > 3 ? label.substring(0, 3) : label;
  const fontSize = displayLabel.length <= 1 ? 28 : displayLabel.length <= 2 ? 22 : 16;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>
  </defs>
  ${bg}
  <text x="32" y="${32 + fontSize/3}" text-anchor="middle" fill="${fgColor}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" filter="url(#glow)">${displayLabel}</text>
</svg>`;
}

// Boss icons — red/dark theme, hex shape
const bosses = [
  ['boss-radscorpion', 'RS', '#2a0a0a', '#ff4444'],
  ['boss-mirelurk', 'MQ', '#0a1a2a', '#44aaff'],
  ['boss-behemoth', 'BH', '#1a1a0a', '#ffaa44'],
  ['boss-deathclaw', 'DC', '#1a0a1a', '#ff44ff'],
];

// Trait icons — colored circles matching trait colors
const traits = [
  ['trait-minutemen', 'M', '#1a2a3a', '#4A90D9'],
  ['trait-wasteland', 'W', '#2a1a0a', '#8B4513'],
  ['trait-support', 'S', '#0a2a1a', '#2E8B57'],
  ['trait-tech', 'T', '#1a1a2a', '#708090'],
  ['trait-scout', 'Sc', '#1a2a0a', '#556B2F'],
  ['trait-brotherhood', 'B', '#0a1a3a', '#3366CC'],
  ['trait-raider', 'R', '#2a0a0a', '#CC3333'],
  ['trait-ghoul', 'G', '#1a2a0a', '#669933'],
];

// Item components — square shape, warm colors
const components = [
  ['item-scrap-metal', 'SM', '#1a1a1a', '#aaaaaa'],
  ['item-stimpak', 'St', '#1a0a0a', '#ff4444'],
  ['item-fusion-cell', 'FC', '#0a1a0a', '#44ff44'],
  ['item-targeting-module', 'TM', '#1a1a0a', '#ffaa00'],
  ['item-stealth-boy', 'SB', '#1a0a2a', '#aa66ff'],
  ['item-nuka-quantum', 'NQ', '#0a0a2a', '#44aaff'],
];

// Completed items — diamond shape, gold accent
const completed = [
  ['item-power-armor', 'PA', '#1a1a2a', '#6688ff'],
  ['item-super-stimpak', 'SS', '#2a0a0a', '#ff6666'],
  ['item-gauss-rifle', 'GR', '#0a2a0a', '#44ff44'],
  ['item-vats-module', 'VM', '#0a0a2a', '#66aaff'],
  ['item-stealth-suit', 'CS', '#1a0a2a', '#aa66ff'],
  ['item-nuka-grenade', 'NG', '#2a1a0a', '#ffaa44'],
  ['item-rad-suit', 'RS', '#0a2a0a', '#44ff44'],
  ['item-jet-injector', 'JI', '#1a1a2a', '#aaccff'],
  ['item-combat-rifle', 'CR', '#1a1a0a', '#ffcc44'],
  ['item-chameleon-armor', 'CA', '#0a2a0a', '#66cc66'],
  ['item-nuka-nuke', 'NN', '#2a0a0a', '#ff4444'],
  ['item-irradiated-blade', 'IB', '#2a1a0a', '#ffaa00'],
  ['item-quantum-scope', 'QS', '#0a0a2a', '#44ccff'],
  ['item-phantom-device', 'PD', '#1a0a2a', '#cc66ff'],
  ['item-stim-rifle', 'MR', '#0a1a0a', '#44ff88'],
  ['item-combat-medic', 'CM', '#0a2a1a', '#66ffaa'],
  ['item-cloak-stim', 'CS', '#1a0a1a', '#cc88ff'],
  ['item-ballistic-weave', 'BW', '#1a1a1a', '#cccccc'],
  ['item-fortified-helm', 'FH', '#1a1a2a', '#8888ff'],
  ['item-infiltrator-kit', 'IK', '#1a0a0a', '#ff8844'],
  ['item-laser-sight', 'LS', '#2a0a0a', '#ff4444'],
];

// Augments — hex shape, purple accent
const augments = [
  ['aug-vault-training', 'VT', '#1a0a2a', '#cc66ff'],
  ['aug-rad-resist', 'RR', '#0a2a0a', '#66ff44'],
  ['aug-scavenger', 'Sv', '#2a1a0a', '#ffcc44'],
  ['aug-overclocked', 'OC', '#2a2a0a', '#ffff44'],
  ['aug-wasteland-hard', 'WH', '#2a0a0a', '#ff6644'],
  ['aug-trigger-disc', 'TD', '#2a1a0a', '#ffaa44'],
  ['aug-pack-rat', 'PR', '#1a1a0a', '#ccaa44'],
  ['aug-arms-dealer', 'AD', '#1a1a1a', '#aaaaaa'],
  ['aug-fast-learner', 'FL', '#0a0a2a', '#4488ff'],
  ['aug-field-medic', 'FM', '#0a2a0a', '#44ff88'],
  ['aug-guerrilla', 'GT', '#2a0a0a', '#ff4444'],
  ['aug-fortified', 'FP', '#0a0a2a', '#6688ff'],
  ['aug-nuka-addict', 'NA', '#0a1a2a', '#44aaff'],
  ['aug-econ-scale', 'ES', '#2a2a0a', '#ffdd44'],
  ['aug-lucky-find', 'LF', '#0a2a0a', '#44ff44'],
];

let count = 0;

for (const [name, label, bg, fg] of bosses) {
  fs.writeFileSync(path.join(outDir, `${name}.svg`), makeSvg(label, bg, fg, 'hex'));
  count++;
}
for (const [name, label, bg, fg] of traits) {
  fs.writeFileSync(path.join(outDir, `${name}.svg`), makeSvg(label, bg, fg, 'circle'));
  count++;
}
for (const [name, label, bg, fg] of components) {
  fs.writeFileSync(path.join(outDir, `${name}.svg`), makeSvg(label, bg, fg, 'square'));
  count++;
}
for (const [name, label, bg, fg] of completed) {
  fs.writeFileSync(path.join(outDir, `${name}.svg`), makeSvg(label, bg, fg, 'diamond'));
  count++;
}
for (const [name, label, bg, fg] of augments) {
  fs.writeFileSync(path.join(outDir, `${name}.svg`), makeSvg(label, bg, fg, 'hex'));
  count++;
}

console.log(`Generated ${count} placeholder SVG icons in ${outDir}`);
