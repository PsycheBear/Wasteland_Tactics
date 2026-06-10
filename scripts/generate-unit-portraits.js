/**
 * Procedural Fallout Shelter–style unit portrait PNGs (Node canvas).
 * Run: node scripts/generate-unit-portraits.js
 *      node scripts/generate-unit-portraits.js marcy liberty fahrenheit
 *      node scripts/generate-unit-portraits.js batch 11-21
 */
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { UNIT_DATABASE } from '../src/data/units.js';
import { COST_COLORS } from '../src/data/constants.js';

const TRAIT_COLORS = {
  Minutemen: '#4A90D9',
  Wasteland: '#8B4513',
  Support: '#2E8B57',
  Tech: '#708090',
  Scout: '#556B2F',
  Brotherhood: '#3366CC',
  Raider: '#CC3333',
  Ghoul: '#669933',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'images', 'units');
const manifestPath = path.join(__dirname, '..', 'src', 'data', 'generatedUnitPngs.js');
const UNIT_IDS = Object.keys(UNIT_DATABASE);
const PORTRAIT = 512;
const SHOP_W = 400;
const SHOP_H = 550;
const BG = '#0a0a1a';
const OUTLINE = '#0d0d0d';

/** Units that still use SVG placeholders in images.js (plus marcy/liberty path stubs). */
export const SVG_PLACEHOLDER_UNITS = [
  'marcy',
  'liberty',
  'fahrenheit',
  'curie',
  'deacon',
  'wiseman',
  'maxson',
  'kellogg',
];

function traitColor(name) {
  return TRAIT_COLORS[name] || '#2E8B57';
}

function parseArgs(argv) {
  const batchIdx = argv.indexOf('batch');
  if (batchIdx >= 0) {
    const rangeArg = argv[batchIdx + 1] || argv.join(' ');
    const m = String(rangeArg).match(/(\d+)\s*-\s*(\d+)/);
    if (!m) throw new Error('Usage: node scripts/generate-unit-portraits.js batch <start>-<end>');
    return { mode: 'batch', start: Number(m[1]), end: Number(m[2]) };
  }
  const ids = argv.filter((a) => !a.startsWith('-') && UNIT_DATABASE[a]);
  if (ids.length) return { mode: 'ids', ids };
  return { mode: 'default', ids: SVG_PLACEHOLDER_UNITS };
}

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(c, a = 1) {
  const { r, g, b } = hex(c);
  return `rgba(${r},${g},${b},${a})`;
}

function stroke(ctx, w = 4) {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function fillStroke(ctx, fill, w = 4) {
  ctx.fillStyle = fill;
  ctx.fill();
  stroke(ctx, w);
  ctx.stroke();
}

function circle(ctx, x, y, r, fill, w = 4) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  fillStroke(ctx, fill, w);
}

function roundRect(ctx, x, y, w, h, r, fill, lw = 4) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  fillStroke(ctx, fill, lw);
}

function pathFill(ctx, fill, w = 3) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (w > 0) {
    stroke(ctx, w);
    ctx.stroke();
  }
}

function eye(ctx, x, y, r, pupil = 0.45, mood = 0) {
  circle(ctx, x, y, r, '#f5f0e6', 3);
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(x, y + mood * 2, r * pupil, r * pupil * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.2, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function vaultBg(ctx, w, h, accent = '#2E8B57') {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#12121f');
  g.addColorStop(1, BG);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = rgba(accent, 0.15);
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = 40 + i * (h / 7);
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(w - 20, y);
    ctx.stroke();
  }
  roundRect(ctx, w * 0.08, h * 0.06, w * 0.84, h * 0.88, 18, 'transparent', 3);
  ctx.strokeStyle = rgba('#c9a227', 0.25);
  ctx.stroke();
}

function rimGlow(ctx, w, h, color, width = 14) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = 0.85;
  roundRect(ctx, width / 2, width / 2, w - width, h - width, 22, 'transparent', width);
  ctx.stroke();
  ctx.restore();
}

function sparkles(ctx, w, h, color, n = 8, seed = 1) {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const t = ((i * 97 * seed) % 360) * (Math.PI / 180);
    const x = w * 0.5 + Math.cos(t) * (w * 0.38);
    const y = h * 0.35 + Math.sin(t) * (h * 0.28);
    ctx.globalAlpha = 0.5 + (i % 3) * 0.15;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 2, y);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 2, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawTraitBadges(ctx, cx, bodyY, s, unitId) {
  const db = UNIT_DATABASE[unitId];
  if (!db?.traits?.length) return;
  const t1 = traitColor(db.traits[0]);
  const t2 = traitColor(db.traits[1] || db.traits[0]);
  roundRect(ctx, cx - s * 0.32, bodyY - s * 0.02, s * 0.14, s * 0.1, 3, t1, 2);
  roundRect(ctx, cx + s * 0.18, bodyY - s * 0.02, s * 0.14, s * 0.1, 3, t2, 2);
}

function drawTorso(ctx, cx, bodyY, s, fill, collar = null) {
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.26, bodyY - s * 0.06);
  ctx.lineTo(cx + s * 0.26, bodyY - s * 0.06);
  ctx.lineTo(cx + s * 0.22, bodyY + s * 0.28);
  ctx.lineTo(cx - s * 0.22, bodyY + s * 0.28);
  ctx.closePath();
  pathFill(ctx, fill, 4);
  if (collar) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.12, bodyY - s * 0.04);
    ctx.lineTo(cx, bodyY + s * 0.04);
    ctx.lineTo(cx + s * 0.12, bodyY - s * 0.04);
    pathFill(ctx, collar, 2);
  }
}

/** @typedef {{ skin:string, hair:string, outfit:string, accent:string, accent2?:string, type:'human'|'ghoul'|'synth'|'robot'|'mutant'|'deathclaw'|'liberty', extra?:string }} UnitArt */

/** @type {Record<string, UnitArt>} */
const ART = {
  danse: { skin: '#c4a882', hair: '#3a3028', outfit: '#4a5a7a', accent: '#3366CC', accent2: '#ff8833', type: 'human', extra: 'danse' },
  dima: { skin: '#b8c8d8', hair: '#5a6a78', outfit: '#2a4a5a', accent: '#4488ff', type: 'synth', extra: 'dima' },
  deathclaw: { skin: '#c4a070', hair: '#8a5030', outfit: '#6a4020', accent: '#cc6622', type: 'deathclaw' },
  marcy: { skin: '#8ab878', hair: '#4a3828', outfit: '#5a5048', accent: '#4A90D9', accent2: '#669933', type: 'ghoul', extra: 'marcy' },
  fahrenheit: { skin: '#d4a888', hair: '#2a1810', outfit: '#4a2020', accent: '#CC3333', accent2: '#ff6622', type: 'human', extra: 'fahrenheit' },
  curie: { skin: '#e8e8f0', hair: '#ccc', outfit: '#f0f0f8', accent: '#cc2233', accent2: '#66AADD', type: 'robot', extra: 'curie' },
  deacon: { skin: '#c8b090', hair: '#2a2820', outfit: '#3a3830', accent: '#556B2F', accent2: '#CC3333', type: 'human', extra: 'deacon' },
  wiseman: { skin: '#7aaa66', hair: '#e8e0c0', outfit: '#3a3530', accent: '#669933', type: 'ghoul', extra: 'wiseman' },
  maxson: { skin: '#b89878', hair: '#c8c0b0', outfit: '#2a3048', accent: '#3366CC', type: 'human', extra: 'maxson' },
  kellogg: { skin: '#a89080', hair: '#1a1410', outfit: '#282018', accent: '#CC3333', accent2: '#708090', type: 'human', extra: 'kellogg' },
  liberty: { skin: '#d0d8e8', hair: '#2244aa', outfit: '#cc2222', accent: '#2244aa', accent2: '#f0f0f8', type: 'liberty' },
};

function artFor(unitId) {
  if (ART[unitId]) return ART[unitId];
  const db = UNIT_DATABASE[unitId];
  if (!db) return null;
  const accent = traitColor(db.traits[0]);
  return {
    skin: '#c4a882',
    hair: '#3a3028',
    outfit: '#3a3a48',
    accent,
    type: 'human',
    extra: unitId,
  };
}

function drawFace(ctx, cx, cy, headR, extra, mood = 0) {
  eye(ctx, cx - headR * 0.38, cy + headR * 0.05, headR * 0.28, 0.42, mood);
  eye(ctx, cx + headR * 0.38, cy + headR * 0.05, headR * 0.28, 0.42, mood);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (extra === 'marcy') {
    ctx.moveTo(cx - headR * 0.35, cy + headR * 0.55);
    ctx.quadraticCurveTo(cx, cy + headR * 0.45, cx + headR * 0.35, cy + headR * 0.55);
  } else if (extra === 'kellogg') {
    ctx.moveTo(cx - headR * 0.25, cy + headR * 0.52);
    ctx.lineTo(cx + headR * 0.25, cy + headR * 0.52);
  } else {
    ctx.moveTo(cx - headR * 0.3, cy + headR * 0.55);
    ctx.quadraticCurveTo(cx, cy + headR * 0.7, cx + headR * 0.3, cy + headR * 0.55);
  }
  ctx.stroke();
}

function drawMarcy(ctx, cx, cy, s, art, star) {
  const headR = s * 0.2;
  const bodyY = cy + headR * 1.05;
  drawTorso(ctx, cx, bodyY, s, art.outfit, art.accent);
  circle(ctx, cx, cy, headR, art.skin, 4);
  ctx.fillStyle = rgba(art.accent2, 0.35);
  ctx.beginPath();
  ctx.ellipse(cx - headR * 0.55, cy + headR * 0.15, headR * 0.35, headR * 0.25, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + headR * 0.5, cy + headR * 0.55, headR * 0.2, headR * 0.15, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = art.hair;
  ctx.beginPath();
  ctx.ellipse(cx, cy - headR * 0.55, headR * 0.75, headR * 0.35, 0, 0, Math.PI * 2);
  pathFill(ctx, art.hair, 3);
  circle(ctx, cx + headR * 0.55, cy - headR * 0.45, headR * 0.22, art.hair, 3);
  roundRect(ctx, cx - headR * 1.05, bodyY + s * 0.02, headR * 0.35, s * 0.32, 4, '#4a4038', 3);
  roundRect(ctx, cx - headR * 1.2, bodyY + s * 0.18, s * 0.08, s * 0.06, 2, '#2a2820', 2);
  ctx.fillStyle = art.accent;
  roundRect(ctx, cx - headR * 0.95, bodyY + s * 0.2, headR * 0.2, headR * 0.12, 2, art.accent, 2);
  drawTraitBadges(ctx, cx, bodyY, s, 'marcy');
  drawFace(ctx, cx, cy, headR, 'marcy', -0.15);
  if (star >= 2) {
    ctx.fillStyle = rgba(art.accent, 0.5);
    ctx.font = `bold ${s * 0.08}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('M', cx - s * 0.28, bodyY + s * 0.12);
  }
}

function drawFahrenheit(ctx, cx, cy, s, art, star) {
  const headR = s * 0.2;
  const bodyY = cy + headR * 1.05;
  drawTorso(ctx, cx, bodyY, s, art.outfit);
  circle(ctx, cx, cy, headR, art.skin, 4);
  ctx.fillStyle = art.hair;
  ctx.beginPath();
  ctx.moveTo(cx - headR * 1.1, cy - headR * 0.15);
  ctx.quadraticCurveTo(cx - headR * 0.3, cy - headR * 1.35, cx, cy - headR * 0.85);
  ctx.quadraticCurveTo(cx + headR * 0.35, cy - headR * 1.4, cx + headR * 1.05, cy - headR * 0.2);
  ctx.lineTo(cx + headR * 0.7, cy - headR * 0.35);
  ctx.quadraticCurveTo(cx, cy - headR * 0.95, cx - headR * 0.65, cy - headR * 0.35);
  pathFill(ctx, art.hair, 3);
  ctx.fillStyle = art.accent2;
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.95, cy - headR * 1.15);
  ctx.lineTo(cx - headR * 0.75, cy - headR * 1.55);
  ctx.lineTo(cx - headR * 0.55, cy - headR * 1.1);
  pathFill(ctx, art.accent2, 2);
  ctx.beginPath();
  ctx.moveTo(cx + headR * 0.95, cy - headR * 1.15);
  ctx.lineTo(cx + headR * 0.75, cy - headR * 1.55);
  ctx.lineTo(cx + headR * 0.55, cy - headR * 1.1);
  pathFill(ctx, art.accent2, 2);
  roundRect(ctx, cx + s * 0.08, bodyY + s * 0.04, s * 0.16, s * 0.28, 5, '#3a2820', 3);
  ctx.fillStyle = rgba(art.accent2, star >= 2 ? 1 : 0.85);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.12 + i * 8, bodyY + s * 0.08);
    ctx.lineTo(cx + s * 0.16 + i * 8, bodyY - s * 0.06);
    ctx.lineTo(cx + s * 0.2 + i * 8, bodyY + s * 0.1);
    ctx.fill();
  }
  if (star >= 3) {
    ctx.fillStyle = rgba('#ff4400', 0.6);
    ctx.beginPath();
    ctx.arc(cx + s * 0.18, bodyY - s * 0.02, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  drawTraitBadges(ctx, cx, bodyY, s, 'fahrenheit');
  drawFace(ctx, cx, cy, headR, 'fahrenheit');
}

function drawHuman(ctx, cx, cy, s, art, star, extra) {
  if (extra === 'marcy') return drawMarcy(ctx, cx, cy, s, art, star);
  if (extra === 'fahrenheit') return drawFahrenheit(ctx, cx, cy, s, art, star);

  const headR = s * 0.22;
  const bodyY = cy + headR * 1.1;
  drawTorso(ctx, cx, bodyY, s, art.outfit);
  circle(ctx, cx, cy, headR, art.skin, 4);

  if (extra === 'danse') {
    roundRect(ctx, cx - headR * 1.1, cy - headR * 0.3, headR * 2.2, headR * 1.35, 8, art.outfit, 4);
    roundRect(ctx, cx - headR * 0.75, cy - headR * 1.15, headR * 1.5, headR * 0.95, 6, '#5a6a88', 4);
    ctx.fillStyle = rgba(art.accent2, 0.9);
    roundRect(ctx, cx - headR * 0.45, cy - headR * 0.55, headR * 0.9, headR * 0.35, 4, rgba(art.accent2, 0.9), 2);
    roundRect(ctx, cx + s * 0.15, bodyY, s * 0.35, s * 0.08, 3, '#3a4a5a', 3);
    if (star >= 3) {
      ctx.fillStyle = rgba(art.accent2, 0.8);
      ctx.fillRect(cx + s * 0.42, bodyY - 4, 12, 8);
    }
  } else if (extra === 'deacon') {
    ctx.beginPath();
    ctx.moveTo(cx - headR * 1.35, cy - headR * 0.15);
    ctx.quadraticCurveTo(cx, cy - headR * 1.65, cx + headR * 1.35, cy - headR * 0.15);
    ctx.lineTo(cx + headR * 1.1, cy + headR * 0.45);
    ctx.lineTo(cx - headR * 1.1, cy + headR * 0.45);
    pathFill(ctx, '#1a1a1a', 4);
    roundRect(ctx, cx - headR * 0.95, cy - headR * 0.05, headR * 1.9, headR * 0.32, 4, '#0a0a0a', 3);
    roundRect(ctx, cx - s * 0.22, bodyY + s * 0.1, s * 0.32, s * 0.07, 2, '#444', 2);
    roundRect(ctx, cx + s * 0.12, bodyY + s * 0.05, s * 0.1, s * 0.2, 2, '#333', 2);
  } else if (extra === 'maxson') {
    roundRect(ctx, cx - headR * 1.2, cy - headR * 1.05, headR * 2.4, headR * 1.15, 8, '#5a6a88', 4);
    ctx.fillStyle = art.hair;
    ctx.fillRect(cx - headR * 0.55, cy - headR * 0.05, headR * 1.1, headR * 0.35);
    roundRect(ctx, cx - headR * 1.15, bodyY - s * 0.05, headR * 2.3, s * 0.38, 6, art.outfit, 4);
    ctx.fillStyle = art.accent;
    ctx.beginPath();
    ctx.moveTo(cx - 10, bodyY - s * 0.15);
    ctx.lineTo(cx, bodyY - s * 0.3);
    ctx.lineTo(cx + 10, bodyY - s * 0.15);
    ctx.lineTo(cx, bodyY - s * 0.05);
    pathFill(ctx, art.accent, 2);
    roundRect(ctx, cx + s * 0.05, bodyY, s * 0.34, s * 0.14, 3, '#3a4a6a', 3);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = '#2a3040';
      ctx.fillRect(cx + s * 0.22 + i * 5, bodyY + 2, 3, 14);
    }
    if (star >= 3) {
      ctx.fillStyle = rgba('#44aaff', 0.7);
      for (let i = 0; i < 4; i++) ctx.fillRect(cx + s * 0.2 + i * 6, bodyY + 4, 4, 10);
    }
  } else if (extra === 'kellogg') {
    ctx.beginPath();
    ctx.ellipse(cx, cy - headR * 0.55, headR, headR * 0.45, 0, 0, Math.PI * 2);
    pathFill(ctx, art.hair, 3);
    roundRect(ctx, cx + headR * 0.35, cy - headR * 0.1, headR * 0.5, headR * 0.55, 4, '#8899aa', 3);
    ctx.fillStyle = '#cc3333';
    circle(ctx, cx + headR * 0.55, cy + headR * 0.05, headR * 0.2, '#333', 2);
    circle(ctx, cx + headR * 0.55, cy + headR * 0.05, headR * 0.1, '#cc3333', 1);
    roundRect(ctx, cx - s * 0.05, bodyY + s * 0.1, s * 0.1, s * 0.14, 2, '#555', 2);
    ctx.fillStyle = rgba(art.accent2, 0.6);
    ctx.fillRect(cx + s * 0.02, bodyY + s * 0.12, 8, 4);
  }

  drawTraitBadges(ctx, cx, bodyY, s, extra);
  const mood = extra === 'kellogg' ? 0.05 : 0;
  drawFace(ctx, cx, cy, headR, extra, mood);
}

function drawGhoul(ctx, cx, cy, s, art, star, extra) {
  if (extra === 'marcy') return drawMarcy(ctx, cx, cy, s, art, star);
  drawHuman(ctx, cx, cy, s, art, star, extra);
  ctx.fillStyle = rgba(art.accent, 0.2);
  circle(ctx, cx, cy, s * 0.3, rgba(art.accent, 0.15), 0);
  if (extra === 'wiseman') {
    ctx.strokeStyle = '#8a7a60';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.22, cy + s * 0.12);
    ctx.lineTo(cx + s * 0.22, cy + s * 0.58);
    ctx.stroke();
    ctx.fillStyle = '#c9a227';
    circle(ctx, cx + s * 0.22, cy + s * 0.6, 12, '#c9a227', 3);
    ctx.fillStyle = art.hair;
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.1, s * 0.22, s * 0.14, 0, 0, Math.PI);
    pathFill(ctx, art.hair, 3);
    ctx.fillStyle = art.hair;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.12, cy + s * 0.08);
    ctx.quadraticCurveTo(cx, cy + s * 0.22, cx + s * 0.12, cy + s * 0.08);
    pathFill(ctx, art.hair, 2);
  }
}

function drawSynth(ctx, cx, cy, s, art, star) {
  const headR = s * 0.22;
  drawTorso(ctx, cx, cy + s * 0.2, s, art.outfit);
  circle(ctx, cx, cy, headR, art.skin, 4);
  ctx.beginPath();
  ctx.ellipse(cx, cy - headR * 0.4, headR * 0.9, headR * 0.35, 0, 0, Math.PI * 2);
  pathFill(ctx, art.hair, 3);
  eye(ctx, cx - headR * 0.35, cy, headR * 0.26, 0.38, 0);
  eye(ctx, cx + headR * 0.35, cy, headR * 0.26, 0.38, 0);
  ctx.fillStyle = rgba(art.accent, 0.5);
  ctx.fillRect(cx - headR * 1.1, cy + headR, headR * 2.2, 4);
  for (let i = -2; i <= 2; i++) {
    circle(ctx, cx + i * 18, cy + s * 0.35, 4, rgba(art.accent, 0.7), 1);
  }
  if (star >= 3) {
    ctx.strokeStyle = rgba(art.accent, 0.4);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.4, s * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawRobot(ctx, cx, cy, s, art, star, extra) {
  if (extra === 'curie') {
    roundRect(ctx, cx - s * 0.3, cy - s * 0.02, s * 0.6, s * 0.45, 14, '#e8e8f0', 4);
    roundRect(ctx, cx - s * 0.22, cy - s * 0.28, s * 0.44, s * 0.22, 10, '#fff', 4);
    ctx.fillStyle = art.accent2;
    ctx.fillRect(cx - s * 0.05, cy - s * 0.22, s * 0.1, s * 0.12);
    eye(ctx, cx - s * 0.1, cy - s * 0.16, s * 0.055, 0.5, 0);
    eye(ctx, cx + s * 0.1, cy - s * 0.16, s * 0.055, 0.5, 0);
    ctx.fillStyle = art.accent;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.02);
    ctx.lineTo(cx - s * 0.06, cy + s * 0.06);
    ctx.lineTo(cx + s * 0.06, cy + s * 0.06);
    pathFill(ctx, art.accent, 2);
    roundRect(ctx, cx - s * 0.34, cy + s * 0.18, s * 0.68, s * 0.3, 10, '#d0d8e0', 4);
    ctx.strokeStyle = art.accent2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.18);
    ctx.lineTo(cx, cy + s * 0.48);
    ctx.stroke();
    roundRect(ctx, cx + s * 0.2, cy + s * 0.22, s * 0.14, s * 0.2, 4, art.accent, 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx + s * 0.24, cy + s * 0.28, s * 0.06, s * 0.08);
    drawTraitBadges(ctx, cx, cy + s * 0.2, s, 'curie');
    if (star >= 3) sparkles(ctx, s * 2, s * 2, '#88ffaa', 6, 3);
    return;
  }
  roundRect(ctx, cx - s * 0.28, cy - s * 0.05, s * 0.56, s * 0.42, 16, art.outfit, 4);
  circle(ctx, cx, cy - s * 0.12, s * 0.2, '#fff', 4);
  ctx.fillStyle = '#88ccaa';
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.1, s * 0.1, 0.2, Math.PI - 0.2);
  ctx.fill();
  eye(ctx, cx - s * 0.08, cy - s * 0.14, s * 0.05, 0.5, -0.05);
  eye(ctx, cx + s * 0.08, cy - s * 0.14, s * 0.05, 0.5, -0.05);
  roundRect(ctx, cx - s * 0.32, cy + s * 0.2, s * 0.64, s * 0.28, 10, '#e0e0e8', 4);
  roundRect(ctx, cx + s * 0.18, cy + s * 0.22, s * 0.12, s * 0.18, 4, art.accent, 3);
  if (star >= 3) sparkles(ctx, s * 2, s * 2, '#88ffaa', 6, 3);
}

function drawDeathclaw(ctx, cx, cy, s, art, star) {
  ctx.fillStyle = art.skin;
  ctx.beginPath();
  ctx.ellipse(cx, cy, s * 0.32, s * 0.28, 0, 0, Math.PI * 2);
  pathFill(ctx, art.skin, 5);
  ctx.fillStyle = art.outfit;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * s * 0.15, cy - s * 0.1);
    ctx.lineTo(cx + side * s * 0.45, cy - s * 0.35);
    ctx.lineTo(cx + side * s * 0.35, cy + s * 0.05);
    pathFill(ctx, art.outfit, 4);
  }
  eye(ctx, cx - s * 0.12, cy - s * 0.02, s * 0.09, 0.55, -0.1);
  eye(ctx, cx + s * 0.12, cy - s * 0.02, s * 0.09, 0.55, -0.1);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.08, cy + s * 0.12);
  ctx.lineTo(cx, cy + s * 0.2);
  ctx.lineTo(cx + s * 0.08, cy + s * 0.12);
  for (let i = -2; i <= 2; i++) {
    ctx.lineTo(cx + i * 5, cy + s * 0.14);
  }
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  if (star >= 3) {
    ctx.fillStyle = rgba(art.accent, 0.6);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * s * 0.35, cy - s * 0.25);
      ctx.lineTo(cx + side * s * 0.2, cy - s * 0.45);
      ctx.lineTo(cx + side * s * 0.05, cy - s * 0.2);
      ctx.fill();
    }
  }
}

function drawLiberty(ctx, cx, cy, s, art, star) {
  const bodyY = cy + s * 0.05;
  roundRect(ctx, cx - s * 0.38, bodyY - s * 0.12, s * 0.76, s * 0.58, 16, art.outfit, 5);
  roundRect(ctx, cx - s * 0.3, cy - s * 0.38, s * 0.6, s * 0.38, 12, art.accent2, 4);
  roundRect(ctx, cx - s * 0.24, cy - s * 0.32, s * 0.48, s * 0.14, 4, art.accent, 3);
  ctx.fillStyle = '#88ccff';
  ctx.fillRect(cx - s * 0.18, cy - s * 0.26, s * 0.36, s * 0.08);
  eye(ctx, cx - s * 0.12, cy - s * 0.2, s * 0.07, 0.55, 0);
  eye(ctx, cx + s * 0.12, cy - s * 0.2, s * 0.07, 0.55, 0);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.12, cy - s * 0.04);
  ctx.lineTo(cx + s * 0.12, cy - s * 0.04);
  ctx.lineTo(cx, cy + s * 0.06);
  pathFill(ctx, '#fff', 2);
  ctx.fillStyle = '#ffcc00';
  ctx.font = `bold ${s * 0.14}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('★', cx, bodyY + s * 0.12);
  roundRect(ctx, cx + s * 0.24, bodyY + s * 0.02, s * 0.16, s * 0.24, 4, '#2a4a2a', 4);
  circle(ctx, cx + s * 0.32, bodyY + s * 0.1, s * 0.05, '#ffcc00', 2);
  ctx.fillStyle = art.accent;
  roundRect(ctx, cx - s * 0.34, bodyY + s * 0.35, s * 0.12, s * 0.18, 3, art.accent, 3);
  drawTraitBadges(ctx, cx, bodyY, s, 'liberty');
  if (star >= 3) {
    ctx.fillStyle = rgba('#44ff44', 0.5);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('★', cx, cy - s * 0.48);
    sparkles(ctx, s * 2, s * 2, '#ffd700', 8, 7);
  }
}

function drawUnit(ctx, w, h, unitId, star) {
  const art = artFor(unitId);
  if (!art) return;
  const cx = w / 2;
  const cy = h * 0.42;
  const s = Math.min(w, h) * 0.9;
  vaultBg(ctx, w, h, art.accent);
  const draw = {
    human: drawHuman,
    ghoul: drawGhoul,
    synth: drawSynth,
    robot: drawRobot,
    deathclaw: drawDeathclaw,
    liberty: drawLiberty,
  }[art.type];
  if (draw) draw(ctx, cx, cy, s, art, star, art.extra);
  if (star === 2) rimGlow(ctx, w, h, 'rgba(192,192,210,0.9)', 12);
  if (star === 3) {
    rimGlow(ctx, w, h, 'rgba(255,204,50,0.95)', 16);
    sparkles(ctx, w, h, '#ffd700', 10, unitId.length);
  }
}

function drawShop(ctx, w, h, unitId) {
  const db = UNIT_DATABASE[unitId];
  const art = artFor(unitId);
  if (!db || !art) return;
  const costColor = COST_COLORS[db.cost] || '#888';
  const t1 = traitColor(db.traits[0]);
  const t2 = traitColor(db.traits[1]);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1a1a28');
  g.addColorStop(1, BG);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  roundRect(ctx, 12, 12, w - 24, h - 24, 16, '#1e1e2e', 5);
  ctx.strokeStyle = costColor;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = t1;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(20, 20);
  ctx.lineTo(w - 20, 20);
  ctx.stroke();
  ctx.strokeStyle = t2;
  ctx.beginPath();
  ctx.moveTo(20, h - 20);
  ctx.lineTo(w - 20, h - 20);
  ctx.stroke();
  const mini = createCanvas(PORTRAIT, PORTRAIT);
  const mctx = mini.getContext('2d');
  drawUnit(mctx, PORTRAIT, PORTRAIT, unitId, Math.min(3, db.cost >= 4 ? 3 : db.cost >= 2 ? 2 : 1));
  ctx.drawImage(mini, (w - PORTRAIT * 0.72) / 2, 70, PORTRAIT * 0.72, PORTRAIT * 0.72);
  if (db.cost >= 5) {
    rimGlow(ctx, w, h, 'rgba(255,215,0,0.5)', 8);
  }
}

function writePng(canvas, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
}

function loadManifestKeys() {
  try {
    const text = fs.readFileSync(manifestPath, 'utf8');
    const m = text.match(/new Set\(\s*(\[[\s\S]*?\])\s*\)/);
    if (m) return new Set(JSON.parse(m[1]));
  } catch {
    /* first run */
  }
  return new Set();
}

function writeManifest(keys) {
  const sorted = [...keys].sort();
  const content = `/** Auto-generated by scripts/generate-unit-portraits.js — do not edit */
export const GENERATED_UNIT_PNGS = new Set(${JSON.stringify(sorted, null, 2)});
`;
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, content);
}

function generateForUnit(unitId, force = false, manifestKeys) {
  let created = 0;
  const art = artFor(unitId);
  if (!art) {
    console.warn(`  skip ${unitId}: no art config`);
    return 0;
  }
  for (const star of [1, 2, 3]) {
    const base = `${unitId}-${star}.png`;
    const file = path.join(outDir, base);
    if (!force && fs.existsSync(file)) {
      manifestKeys.add(base.replace('.png', ''));
      continue;
    }
    const canvas = createCanvas(PORTRAIT, PORTRAIT);
    drawUnit(canvas.getContext('2d'), PORTRAIT, PORTRAIT, unitId, star);
    writePng(canvas, file);
    manifestKeys.add(`${unitId}-${star}`);
    created++;
    console.log(`  wrote ${path.basename(file)}`);
  }
  const shopBase = `${unitId}-shop.png`;
  const shopFile = path.join(outDir, shopBase);
  if (!force && fs.existsSync(shopFile)) {
    manifestKeys.add(`${unitId}-shop`);
  } else {
    const shop = createCanvas(SHOP_W, SHOP_H);
    drawShop(shop.getContext('2d'), SHOP_W, SHOP_H, unitId);
    writePng(shop, shopFile);
    manifestKeys.add(`${unitId}-shop`);
    created++;
    console.log(`  wrote ${path.basename(shopFile)}`);
  }
  return created;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  let ids;
  if (parsed.mode === 'batch') {
    ids = UNIT_IDS.slice(parsed.start, parsed.end + 1);
  } else {
    ids = parsed.ids;
  }
  if (!ids.length) {
    console.error('No units to generate');
    process.exit(1);
  }
  console.log(`Generating portraits → public/images/units/\nUnits: ${ids.join(', ')}`);
  const manifestKeys = loadManifestKeys();
  let total = 0;
  for (const id of ids) {
    console.log(id);
    total += generateForUnit(id, true, manifestKeys);
  }
  writeManifest(manifestKeys);
  console.log(`\nCreated ${total} file(s). Manifest: ${manifestKeys.size} PNG key(s).`);
  return total;
}

main();
