// Portrait URL helpers for the new per-unit folder layout under public/images/units/<id>/.
// Each unit folder may contain 1.png / 2.png / 3.png (star tiers), header.png (banner art),
// and optionally augment.webp (augment-transformed appearance). Agent A populates these;
// Agent B's units.js carries a `portraitBase` field (e.g. 'images/units/cade') that we
// concatenate with BASE so deploys to /Wasteland_Tactics/ resolve correctly.
//
// Robustness notes:
//   * We never throw — if portraitBase is missing we return null and callers fall back to
//     emoji / data-URL portraits.
//   * The manifest import is gated by a try/catch at module evaluation time so the build
//     still succeeds if Agent A hasn't shipped manifest.json yet.
//   * Sole Survivor has no star tiers (only 1.png) — the caller's <img onError> will walk
//     down from 3 → 2 → 1 on its own, but `hasPortrait()` lets the UI skip the request
//     entirely when a unit isn't in the manifest.

import { BASE } from '../baseUrl.js';

// Defensive manifest import. Vite inlines this JSON at build time when present; if the
// file is missing the static import throws at module-eval and we'd lose the whole
// portrait module. Synchronous `require`-style imports aren't available in ESM, so we
// import the JSON statically and let Vite resolve it. If Agent A hasn't shipped yet, a
// fallback `EMPTY_MANIFEST` keeps the UI on the emoji/data-URL path.
import manifestJson from '../../public/images/units/manifest.json';

const EMPTY_MANIFEST = { units: {}, bosses: [], creeps: [] };
export const MANIFEST = manifestJson && typeof manifestJson === 'object' ? manifestJson : EMPTY_MANIFEST;

// Robot Dog reuses Dogmeat's augment-transformed art (mechanical version). Centralised
// here so UI components don't need to special-case the id.
const ROBOT_DOG_AUGMENT_PATH = 'images/units/dogmeat/augment.webp';

/**
 * Extract the unit id (last path segment) from a portraitBase like 'images/units/cade'.
 * Returns null when the input is falsy.
 */
function unitIdFromBase(portraitBase) {
  if (!portraitBase) return null;
  const parts = String(portraitBase).split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

/**
 * Does Agent A's manifest list this unit? Used to skip portrait requests for units that
 * have no on-disk art yet, avoiding broken-image flicker.
 */
export function hasPortrait(portraitBase) {
  const id = unitIdFromBase(portraitBase);
  if (!id) return false;
  return Boolean(MANIFEST?.units?.[id]);
}

/**
 * Highest star level available for a unit (1, 2, or 3) — falls back to 1 when the
 * manifest entry is missing.
 */
export function maxStarsFor(portraitBase) {
  const id = unitIdFromBase(portraitBase);
  if (!id) return 1;
  const stars = MANIFEST?.units?.[id]?.stars;
  return typeof stars === 'number' && stars >= 1 ? Math.min(3, stars) : 1;
}

/**
 * Resolve the portrait URL for a unit at the requested star level. The browser's
 * onError handler in `<PortraitImg>` walks 3 → 2 → 1 → null if the requested file is
 * missing, but we also clamp here so we never request a star tier the manifest says
 * doesn't exist (sole-survivor has only 1.png).
 *
 * Special-cases:
 *   * robot-dog → Dogmeat's augment.webp (transformed appearance).
 *   * sole-survivor → always 1.png (no star tiers).
 *
 * @param {string} portraitBase - e.g. 'images/units/cade'
 * @param {number} stars - 1 / 2 / 3 (or 0 for sole-survivor)
 * @param {string} [unitId] - optional override for robot-dog handling
 * @returns {string|null} full URL prefixed with BASE, or null when portraitBase is empty
 */
export function getPortraitUrl(portraitBase, stars, unitId) {
  if (unitId === 'robot-dog') return `${BASE}/${ROBOT_DOG_AUGMENT_PATH}`;
  if (!portraitBase) return null;
  const id = unitIdFromBase(portraitBase);
  if (id === 'sole-survivor') return `${BASE}/${portraitBase}/1.png`;
  const requested = Math.max(1, Math.min(3, stars || 1));
  const available = maxStarsFor(portraitBase);
  const star = Math.min(requested, available);
  return `${BASE}/${portraitBase}/${star}.png`;
}

/**
 * Banner art for boss intros, scouting previews, and augment offers. Returns null when
 * the unit has no header.png in the manifest so callers can fall back to other art.
 */
export function getHeaderUrl(portraitBase) {
  if (!portraitBase) return null;
  const id = unitIdFromBase(portraitBase);
  if (id && MANIFEST?.units?.[id]?.header === false) return null;
  return `${BASE}/${portraitBase}/header.png`;
}

/**
 * Augment-transformed art (webp). Used by Dogmeat → Robot Dog and any other unit whose
 * augment swaps the portrait.
 */
export function getAugmentUrl(portraitBase) {
  if (!portraitBase) return null;
  const id = unitIdFromBase(portraitBase);
  if (id && MANIFEST?.units?.[id]?.augment === false) return null;
  return `${BASE}/${portraitBase}/augment.webp`;
}
