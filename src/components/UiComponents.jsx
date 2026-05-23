import React from 'react';
import { UNIT_DATABASE } from '../data/units.js';
import { TRAITS } from '../data/traits.js';
import { ITEM_COMPONENTS, COMPLETED_ITEMS } from '../data/items.js';
import { COST_COLORS } from '../data/constants.js';
import { LORE } from '../data/lore.js';
import { GameIcon } from './GameIcon.jsx';
import { getWeaponType, IDLE_CLASSES } from '../systems/unitTypes.js';
import { IMAGES } from '../data/images.js';
import {
  getPortraitUrl,
  getHeaderUrl,
  getAugmentUrl,
  hasPortrait,
  maxStarsFor,
} from '../lib/portraitPath.js';

// Re-export so Game.jsx / BossIntro.jsx can pull header art via a single import path.
export { getPortraitUrl, getHeaderUrl, getAugmentUrl, hasPortrait };

/* ─── Range / faction / role visual metadata ───
 * Lookup tables keyed off the new unit-database fields Agent B is adding. Centralised
 * here so UnitCard + UnitTooltip share one source of truth. Colors mirror typical
 * Fallout faction palettes where possible. */
// Inline SVG range icons (replaced legacy emoji glyphs).
const RangeIconMelee = (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true" style={{ verticalAlign: 'middle' }}>
    <path d="M3 5 L5 3 L15 13 L13 15 Z"/>
    <path d="M21 5 L19 3 L9 13 L11 15 Z"/>
    <path d="M2 18 L4 16 L8 20 L6 22 Z"/>
    <path d="M22 18 L20 16 L16 20 L18 22 Z"/>
  </svg>
);
const RangeIconRanged = (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" style={{ verticalAlign: 'middle' }}>
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="5"/>
    <circle cx="12" cy="12" r="1.6" fill="currentColor"/>
  </svg>
);
const RangeIconDual = (
  <svg viewBox="0 0 28 24" width="14" height="12" fill="currentColor" aria-hidden="true" style={{ verticalAlign: 'middle' }}>
    <path d="M3 5 L5 3 L11 9 L9 11 Z"/>
    <path d="M2 18 L4 16 L8 20 L6 22 Z"/>
    <path d="M14 12 L20 12 M16 9 L14 12 L16 15" fill="none" stroke="currentColor" strokeWidth="1.6"/>
    <circle cx="24" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6"/>
    <circle cx="24" cy="12" r="0.8"/>
  </svg>
);
const RANGE_META = {
  melee: { icon: '', svg: RangeIconMelee, label: 'Melee', color: '#ff8855', desc: 'Strikes from the front rows.' },
  ranged: { icon: '', svg: RangeIconRanged, label: 'Ranged', color: '#88bbff', desc: 'Attacks from the back rows.' },
  dual: { icon: '', svg: RangeIconDual, label: 'Dual', color: '#ffd700', desc: 'Dual range — melee in front rows, ranged in back rows.' },
};
const FACTION_COLORS = {
  Minutemen: '#4A90D9', Brotherhood: '#3366CC', Railroad: '#cc4488', Institute: '#88ccff',
  Raider: '#CC3333', Wastelander: '#8B4513', Ghoul: '#669933', SuperMutant: '#7a6e3a',
  Synth: '#aaaadd', NukaWorld: '#ff5577', Enclave: '#666666',
};
const ROLE_COLORS = {
  Tank: '#6688ff', Bruiser: '#cc7744', Carry: '#ff4444', Marksman: '#ffaa44',
  Support: '#44cc88', Healer: '#66ddaa', Caster: '#aa55ff', Assassin: '#883388',
  Scout: '#88aa55', Bomber: '#ff7733', Disruptor: '#bb55cc',
};
const getFactionColor = (f) => FACTION_COLORS[f] || '#aaa';
const getRoleColor = (r) => ROLE_COLORS[r] || '#aaa';

/* ─── PortraitImg ─── tries the per-star portrait under public/images/units/<id>/<n>.png
 * first (Agent A's new folder layout), then walks 3 → 2 → 1 if the requested star tier
 * isn't available, then falls back to the legacy IMAGES data URL, then renders null so
 * the caller can show a UnitPlaceholder.
 *
 * Props:
 *   * `unit` or `unitDef` — either accepted; both used as a portraitBase source. `unit`
 *     wins when provided (it carries the live stars).
 *   * `unitId` / `starLevel` — legacy entry points still supported.
 *   * `forceHeader` — when true, renders header.png instead of <star>.png.
 */
export function PortraitImg({ unit, unitDef, unitId, starLevel, size, alt, forceHeader = false }) {
  // Resolve unit id + def + stars from whichever combination of props the caller gave us.
  const id = unit?.id || unitId || unitDef?.id || null;
  const def = unitDef || (id ? UNIT_DATABASE[id] : null) || {};
  const stars = unit?.stars ?? starLevel ?? 1;
  const portraitBase = def?.portraitBase || null;
  const altText = alt || unit?.name || def?.name || id || 'unit';

  // Robot Dog is Dogmeat's augment art — special-case before the manifest check so we
  // don't gate it on a `robot-dog` manifest entry that doesn't exist.
  const isRobotDog = id === 'robot-dog';
  const isSoleSurvivor = id === 'sole-survivor';

  // Build the candidate URL chain. The new folder layout sits at the head; we fall back
  // to the legacy `def.portrait` field (Wave 1) and finally IMAGES[].
  const candidates = React.useMemo(() => {
    const list = [];
    if (isRobotDog) {
      // Robot Dog reuses Dogmeat's augment-transformed appearance.
      const dogDef = UNIT_DATABASE.dogmeat || {};
      const dogBase = dogDef.portraitBase || 'images/units/dogmeat';
      const augUrl = getAugmentUrl(dogBase);
      if (augUrl) list.push(augUrl);
      // Fall back to Dogmeat's regular star portrait if augment.webp is missing.
      const dogPortrait = getPortraitUrl(dogBase, stars);
      if (dogPortrait) list.push(dogPortrait);
    } else if (portraitBase && (forceHeader || hasPortrait(portraitBase) || isSoleSurvivor)) {
      if (forceHeader) {
        const headerUrl = getHeaderUrl(portraitBase);
        if (headerUrl) list.push(headerUrl);
      }
      if (isSoleSurvivor) {
        list.push(getPortraitUrl(portraitBase, 1, id));
      } else {
        // Walk down star tiers so onError gets a graceful fallback chain.
        const top = Math.min(3, Math.max(1, maxStarsFor(portraitBase)));
        const requested = Math.max(1, Math.min(top, stars));
        for (let s = requested; s >= 1; s--) {
          list.push(`${getPortraitUrl(portraitBase, s, id)}`);
        }
        // Header art as a final per-folder fallback (some units may have header but no
        // numbered star yet).
        const headerUrl = getHeaderUrl(portraitBase);
        if (headerUrl) list.push(headerUrl);
      }
    }
    // Legacy Wave-1 single-portrait field.
    if (def?.portrait && !list.includes(def.portrait)) list.push(def.portrait);
    // Legacy data-URL fallback.
    const dataUrl = IMAGES[id]?.[stars] || IMAGES[id]?.[1] || null;
    if (dataUrl && !list.includes(dataUrl)) list.push(dataUrl);
    return list;
  }, [id, portraitBase, stars, forceHeader, isRobotDog, isSoleSurvivor, def?.portrait]);

  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => { setIdx(0); }, [id, stars, forceHeader]);

  const src = candidates[idx] || null;
  if (!src) return null;
  return (
    <img
      src={src}
      alt={altText}
      draggable={false}
      onError={() => {
        // Step down the candidate list — last entry resolves to null and the caller
        // can render a UnitPlaceholder.
        setIdx((i) => (i + 1 < candidates.length ? i + 1 : i + 1));
      }}
      style={{ width: size, height: size, objectFit: 'contain', pointerEvents: 'none' }}
    />
  );
}

/* ─── helpers ─── */
const getColor = (cost) => COST_COLORS[cost] || '#888';
const stars = (n) => '\u2605'.repeat(n);
const getUnitImage = (unitId, starLevel) => {
  const img = IMAGES[unitId]?.[starLevel] || IMAGES[unitId]?.[1];
  return img || null;
};
const TIER_GLOW = {
  1: 'none',
  2: '0 0 6px rgba(30,255,0,0.2)',
  3: '0 0 6px rgba(68,136,255,0.3)',
  4: '0 0 8px rgba(204,68,255,0.3)',
  5: '0 0 10px rgba(255,215,0,0.4)',
};

/* ─── CombatBars ─── */
export function CombatBars({ currentHp, maxHp, mana, manaMax, variant = 'ally', compact = false }) {
  const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;
  const manaPct = manaMax > 0 ? Math.max(0, Math.min(100, (mana / manaMax) * 100)) : 0;
  const manaFull = mana >= manaMax;

  const barWidth = compact ? 50 : 60;
  const barHeight = compact ? 10 : 12;

  const hpColor = variant === 'enemy' ? '#ff4444' : '#44ff44';
  const hpBg = variant === 'enemy' ? 'rgba(100,0,0,0.6)' : 'rgba(0,60,0,0.6)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, width: barWidth }}>
      {/* HP bar */}
      <div style={{
        width: '100%', height: barHeight, background: hpBg,
        borderRadius: 2, overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          width: `${hpPct}%`, height: '100%', background: hpColor,
          borderRadius: 2, transition: 'width 0.3s ease',
        }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 'bold', color: '#fff', textShadow: '0 0 2px #000, 0 0 4px #000',
          lineHeight: 1, pointerEvents: 'none',
        }}>
          {Math.round(Math.max(0, currentHp))}/{Math.round(maxHp)}
        </div>
      </div>
      {/* AP / Mana bar */}
      <div style={{
        width: '100%', height: barHeight - 2, background: 'rgba(0,0,60,0.6)',
        borderRadius: 2, overflow: 'hidden', position: 'relative',
        boxShadow: manaFull ? '0 0 6px rgba(0,150,255,0.8)' : 'none',
      }}>
        <div style={{
          width: `${manaPct}%`, height: '100%',
          background: manaFull ? '#00ccff' : '#4488ff',
          borderRadius: 2, transition: 'width 0.2s ease',
        }} />
        {manaMax > 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 'bold', color: '#fff', textShadow: '0 0 2px #000, 0 0 4px #000',
            lineHeight: 1, pointerEvents: 'none',
          }}>
            {Math.round(mana)}/{manaMax}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── UnitPlaceholder ─── */
export function UnitPlaceholder({ name, size }) {
  const letter = name ? name.charAt(0).toUpperCase() : '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #555 0%, #333 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.45, fontWeight: 'bold', color: '#ddd',
      border: '2px solid #666', textShadow: '1px 1px 2px black',
      flexShrink: 0,
    }}>
      {letter}
    </div>
  );
}

/* ─── UnitTooltip ─── */
export function UnitTooltip({ unitTooltip, onClose }) {
  // Expanded-lore toggle: hold Shift on desktop, or long-press anywhere on touch.
  const [showLore, setShowLore] = React.useState(false);
  React.useEffect(() => {
    if (!unitTooltip) { setShowLore(false); return; }
    const onKeyDown = (e) => { if (e.key === 'Shift') setShowLore(true); };
    const onKeyUp = (e) => { if (e.key === 'Shift') setShowLore(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [unitTooltip]);
  // Long-press handlers attached on the tooltip card itself for touch.
  const longPressTimer = React.useRef(null);
  const startLongPress = () => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => setShowLore(true), 500);
  };
  const cancelLongPress = () => {
    clearTimeout(longPressTimer.current);
    setShowLore(false);
  };

  if (!unitTooltip) return null;
  const { unit, x, y, sticky } = unitTooltip;
  // Right-click (sticky) tooltips dock to the right edge of the viewport (TFT-style).
  // Hover tooltips still float at the cursor.
  const docked = !!sticky;
  const rawDb = UNIT_DATABASE[unit.id] || {};
  // Robot Dog displays as "Robot Dog" even though it shares Dogmeat's data structure.
  const db = unit.id === 'robot-dog' ? { ...rawDb, name: 'Robot Dog' } : rawDb;
  const displayName = unit.id === 'robot-dog' ? 'Robot Dog' : (unit.name || db.name);
  const loreText = LORE.units?.[unit.id];

  // Gather item info
  const equippedItems = unit.items || [];

  // Range / faction / role meta — gracefully degrade when Agent B hasn't shipped these
  // fields yet (older units.js had no `range` enum, just a numeric range).
  const rangeKey = typeof db.range === 'string' ? db.range : null;
  const rangeMeta = rangeKey ? RANGE_META[rangeKey] : null;
  const faction = db.faction || null;
  const role = db.role || null;

  return (
    <>
      {/* Backdrop to close on click */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 3000, background: 'transparent',
      }} />
      <div
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
        style={docked ? {
          // Docked (right-click): TFT-style right-edge panel.
          position: 'fixed', right: 12, top: 80,
          zIndex: 3001, background: 'linear-gradient(180deg, rgba(22,22,22,0.96), rgba(12,12,12,0.96))',
          border: `2px solid ${getColor(unit.cost)}`,
          borderRadius: 8, padding: 14, width: 280,
          maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
          color: '#eee', fontSize: 13,
          boxShadow: `0 0 20px ${getColor(unit.cost)}55, 0 8px 32px rgba(0,0,0,0.5)`,
          pointerEvents: 'auto',
          animation: 'wt-tooltip-slide-in 0.18s ease-out',
        } : {
          // Hover / cursor-anchored.
          position: 'fixed', left: Math.min(x, window.innerWidth - 280), top: Math.min(y, window.innerHeight - 350),
          zIndex: 3001, background: 'rgba(20,20,20,0.95)', border: '2px solid #ffd700',
          borderRadius: 6, padding: 12, minWidth: 240, maxWidth: 300,
          color: '#eee', fontSize: 13, boxShadow: '0 0 20px rgba(255,215,0,0.3)',
          pointerEvents: 'auto',
        }}>
        {/* Name + stars */}
        <div style={{ fontSize: 16, fontWeight: 'bold', color: getColor(unit.cost), marginBottom: 4 }}>
          {displayName} {stars(unit.stars)}
        </div>

        {/* Range / Faction / Role badges (only shown when Agent B's data is present). */}
        {(rangeMeta || faction || role) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {rangeMeta && (
              <span
                title={rangeMeta.desc}
                style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 3,
                  background: 'rgba(0,0,0,0.4)', color: rangeMeta.color,
                  border: `1px solid ${rangeMeta.color}66`,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}
              >
                <span aria-hidden="true">{rangeMeta.svg || rangeMeta.icon}</span> {rangeMeta.label}
              </span>
            )}
            {faction && (
              <span
                title={`Faction: ${faction}`}
                style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 3,
                  background: 'rgba(0,0,0,0.4)', color: getFactionColor(faction),
                  border: `1px solid ${getFactionColor(faction)}66`,
                }}
              >
                {faction}
              </span>
            )}
            {role && (
              <span
                title={`Role: ${role}`}
                style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 3,
                  background: 'rgba(0,0,0,0.4)', color: getRoleColor(role),
                  border: `1px solid ${getRoleColor(role)}66`,
                }}
              >
                {role}
              </span>
            )}
          </div>
        )}

        {/* Traits */}
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>
          {(db.traits || unit.traits || []).map(t => {
            const trait = TRAITS[t];
            return trait ? (
              <span key={t} style={{ marginRight: 6, color: trait.color, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <GameIcon iconImg={trait.iconImg} icon={trait.icon} size={12} /> {trait.name}
              </span>
            ) : t;
          })}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 6, fontSize: 12 }}>
          <div>HP: <span style={{ color: '#44ff44' }}>{unit.currentHp !== undefined ? `${Math.round(unit.currentHp)}/${unit.maxHp}` : unit.hp || db.hp}</span></div>
          <div>ATK: <span style={{ color: '#ff6666' }}>{unit.atk || db.atk}</span></div>
          <div>DEF: <span style={{ color: '#6688ff' }}>{unit.def || db.def}</span></div>
        </div>

        {/* Ability */}
        {(db.ability || unit.ability) && (
          <div style={{ marginBottom: 4, padding: '4px 6px', background: 'rgba(0,100,200,0.2)', borderRadius: 3 }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#66bbff' }}>{db.ability || unit.ability}</div>
            <div style={{ fontSize: 11, color: '#aaa' }}>{db.abilityDesc || ''}</div>
          </div>
        )}

        {/* Passive */}
        {db.passiveDesc && (
          <div style={{ fontSize: 11, color: '#99aa77', marginBottom: 4, fontStyle: 'italic' }}>
            {db.passiveDesc}
          </div>
        )}

        {/* Equipped items */}
        {equippedItems.length > 0 && (
          <div style={{ marginTop: 4, borderTop: '1px solid #444', paddingTop: 4 }}>
            <div style={{ fontSize: 11, color: '#ffaa00', fontWeight: 'bold', marginBottom: 2 }}>Items:</div>
            {equippedItems.map((itemKey, i) => {
              const comp = ITEM_COMPONENTS[itemKey];
              const completed = COMPLETED_ITEMS[itemKey];
              const item = completed || comp;
              return item ? (
                <div key={i} style={{ fontSize: 11, color: completed ? '#ffcc00' : '#ccc' }}>
                  <GameIcon iconImg={item.iconImg} icon={item.icon} size={11} /> {item.name} — <span style={{ color: '#999' }}>{item.desc}</span>
                </div>
              ) : null;
            })}
            {/* Recipe hints — for each EQUIPPED COMPONENT, surface up to 3 possible
                completed items it can combine into. Helps players see what their
                next pairing should be without memorising the 25-item recipe table. */}
            {(() => {
              const hintsByComponent = equippedItems.reduce((acc, itemKey) => {
                if (!ITEM_COMPONENTS[itemKey] || COMPLETED_ITEMS[itemKey]) return acc;
                const recipes = Object.values(COMPLETED_ITEMS).filter(it => Array.isArray(it.recipe) && it.recipe.includes(itemKey));
                if (recipes.length === 0) return acc;
                acc[itemKey] = recipes.slice(0, 3);
                return acc;
              }, {});
              const keys = Object.keys(hintsByComponent);
              if (keys.length === 0) return null;
              return (
                <div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px dashed rgba(255,170,0,0.25)' }}>
                  <div style={{ fontSize: 9, color: '#aa7700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Combines into…</div>
                  {keys.map(compKey => {
                    const comp = ITEM_COMPONENTS[compKey];
                    return (
                      <div key={compKey} style={{ fontSize: 9, color: '#ccaa66', lineHeight: 1.4 }}>
                        <span style={{ color: '#ffaa00' }}>{comp?.name}</span> + ? → {hintsByComponent[compKey].map((r, i) => (
                          <span key={i}><span style={{ color: '#ffcc00' }}>{r.name}</span>{i < hintsByComponent[compKey].length - 1 ? ', ' : ''}</span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Lore — small italic blockquote shown when Shift is held (desktop) or
            during a long-press (touch). Skipped silently when LORE has no entry
            for this unit ID. */}
        {loreText && showLore && (
          <blockquote style={{
            marginTop: 6, marginLeft: 0, marginRight: 0,
            borderTop: '1px solid #444', paddingTop: 6,
            fontSize: 10, fontStyle: 'italic', color: '#bbb',
            lineHeight: 1.45, borderLeft: '2px solid #ffd70066', paddingLeft: 6,
          }}>
            {loreText}
          </blockquote>
        )}
        {loreText && !showLore && (
          <div style={{ marginTop: 4, fontSize: 9, opacity: 0.45, color: '#aaa' }}>
            Hold Shift (or long-press) for lore
          </div>
        )}
      </div>
    </>
  );
}

/* ─── UnitCard ─── */
export function UnitCard({
  unit, location, index, small,
  selected, draggedFrom, phase,
  combatUnits, animations,
  onPointerDown, onContextMenu, onClick,
  selectedItem, isBoard,
}) {
  if (!unit) return null;

  const db = UNIT_DATABASE[unit.id] || {};
  // Robot Dog reuses Dogmeat's portrait folder but displays under its own name.
  const displayName = unit.id === 'robot-dog' ? 'Robot Dog' : (unit.name || db.name);
  const isSelected = selected && selected.location === location && selected.index === index;
  const isDragSource = draggedFrom && draggedFrom.location === location && draggedFrom.index === index;
  const inCombat = phase === 'combat';
  const combatUnit = inCombat ? combatUnits.find(cu => cu.uid === unit.uid) : null;
  const displayUnit = combatUnit || unit;

  // Animation classes
  const isAttacking = animations.attacking.includes(unit.uid);
  const isHit = animations.hit.includes(unit.uid);
  const isDying = animations.dying.includes(unit.uid);
  const isAbility = animations.ability?.includes(unit.uid);
  const isManaFull = displayUnit.mana >= displayUnit.manaMax && displayUnit.manaMax > 0;
  const weaponType = getWeaponType(unit.id);
  const idleClass = inCombat && !isAttacking && !isHit && !isDying && !isAbility ? (IDLE_CLASSES[weaponType] || '') : '';
  const legendaryClass = unit.stars >= 3 ? 'wt-legendary-border wt-legendary-glow' : '';
  const animClass = (isAbility ? 'wt-anim-ability' : isDying ? 'wt-anim-dying' : isHit ? 'wt-anim-hit' : isAttacking ? 'wt-anim-attack' : idleClass) + (isManaFull ? ' wt-mana-full' : '') + (legendaryClass ? ` ${legendaryClass}` : '');

  const imgSize = small ? 44 : 56;
  const unitImg = getUnitImage(unit.id, unit.stars);
  // Has the new folder-based portrait set? (Agent A's manifest). Falls back to the
  // legacy data-URL when not present.
  const hasNewPortrait = db.portraitBase
    ? hasPortrait(db.portraitBase) || unit.id === 'sole-survivor'
    : false;
  // Robot Dog also gets a portrait (via Dogmeat's augment.webp).
  const hasAnyPortrait = hasNewPortrait || unit.id === 'robot-dog' || db.portrait || unitImg;

  // DUAL range visual cue — Agent B sets `range: 'dual'` for Hancock, Sarah Lyon,
  // Sole Survivor. We render a small top-right badge so the card glance-tells.
  const isDualRange = db.range === 'dual';

  // Item badges
  const equippedItems = unit.items || [];

  const cardContent = (
    <>
      {/* Cost color top border */}
      <div style={{
        position: 'absolute', top: -2, left: 0, right: 0, height: 3,
        background: getColor(unit.cost), borderRadius: '4px 4px 0 0',
      }} />

      {/* Cost tier badge — top-left corner. Always visible on bench + board so the
          player can tell tier at a glance (TFT-style). */}
      <span
        className="wt-cost-badge"
        title={`Cost ${unit.cost} (tier ${unit.cost})`}
        style={{
          position: 'absolute', top: -2, left: -2, zIndex: 2,
          minWidth: 14, height: 14, padding: '0 3px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 'bold', fontFamily: "'Share Tech Mono', monospace",
          background: getColor(unit.cost), color: '#0a0a0a',
          border: '1px solid rgba(0,0,0,0.6)', borderRadius: 3,
          pointerEvents: 'none', userSelect: 'none',
          textShadow: '0 1px 0 rgba(255,255,255,0.25)',
        }}
      >{unit.cost}</span>

      {/* DUAL range badge — corner indicator, doesn't obstruct portrait.
          Uses inline SVG (no emojis — see feedback_no_emojis memory). */}
      {isDualRange && (
        <span
          className="wt-range-dual-badge"
          title="Dual range — melee in front rows, ranged in back rows"
          style={{
            position: 'absolute', top: -2, right: -2, zIndex: 2,
            lineHeight: 0, padding: 2,
            background: 'rgba(20,20,20,0.85)',
            border: '1px solid #ffd700', borderRadius: 3,
            pointerEvents: 'none', userSelect: 'none',
            boxShadow: '0 0 4px rgba(255,215,0,0.6)',
          }}
          aria-label="dual range"
        >
          <svg width="18" height="10" viewBox="0 0 28 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* sword (melee) */}
            <path d="M2.5 9.5 L8 4 L9 5 L3.5 10.5 Z" fill="#ffd700" stroke="#806000" strokeWidth="0.4" />
            <path d="M8 4 L10 2 L11.5 3.5 L9.5 5.5 Z" fill="#fff7a0" stroke="#806000" strokeWidth="0.4" />
            {/* arrow between */}
            <path d="M12.5 6 L15.5 6 M14.2 4.8 L15.5 6 L14.2 7.2" stroke="#ffd700" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* crosshair (ranged) */}
            <circle cx="22" cy="6" r="3.2" fill="none" stroke="#ffd700" strokeWidth="0.9" />
            <line x1="22" y1="2" x2="22" y2="4" stroke="#ffd700" strokeWidth="0.9" strokeLinecap="round" />
            <line x1="22" y1="8" x2="22" y2="10" stroke="#ffd700" strokeWidth="0.9" strokeLinecap="round" />
            <line x1="18" y1="6" x2="20" y2="6" stroke="#ffd700" strokeWidth="0.9" strokeLinecap="round" />
            <line x1="24" y1="6" x2="26" y2="6" stroke="#ffd700" strokeWidth="0.9" strokeLinecap="round" />
            <circle cx="22" cy="6" r="0.8" fill="#ffd700" />
          </svg>
        </span>
      )}

      {/* Unit portrait — new folder layout → legacy data URL → placeholder fallback. */}
      {hasAnyPortrait ? (
        <PortraitImg unit={unit} unitDef={db} size={imgSize} alt={displayName} />
      ) : (
        <UnitPlaceholder name={displayName} size={imgSize} />
      )}

      {/* Star indicators */}
      <div style={{ fontSize: 9, lineHeight: 1 }}>{stars(unit.stars)}</div>

      {/* Item badges */}
      {equippedItems.length > 0 && (
        <div style={{
          position: 'absolute', bottom: inCombat ? 18 : 2, right: -2,
          display: 'flex', gap: 1,
        }}>
          {equippedItems.map((itemKey, i) => {
            const comp = ITEM_COMPONENTS[itemKey];
            const completed = COMPLETED_ITEMS[itemKey];
            const item = completed || comp;
            return item ? (
              <span key={i} style={{
                fontSize: 10, background: 'rgba(0,0,0,0.7)', borderRadius: 2, padding: '0 1px',
                border: completed ? '1px solid #ffaa00' : '1px solid #555',
              }}>
                <GameIcon iconImg={item.iconImg} icon={item.icon} size={10} />
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* Combat bars (HP + AP) shown during battle */}
      {inCombat && displayUnit.currentHp !== undefined && (
        <CombatBars
          currentHp={displayUnit.currentHp}
          maxHp={displayUnit.maxHp}
          mana={displayUnit.mana}
          manaMax={displayUnit.manaMax}
          variant="ally"
          compact
        />
      )}
    </>
  );

  return (
    <div
      className={animClass}
      data-unit-uid={unit.uid}
      onPointerDown={(e) => onPointerDown?.(e, location, index, unit)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e, unit); }}
      onClick={(e) => onClick?.(e, unit, location, index)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: selectedItem ? 'crosshair' : 'pointer',
        opacity: isDragSource ? 0.3 : (isDying ? undefined : (displayUnit.currentHp !== undefined && displayUnit.currentHp <= 0) ? 0.3 : 1),
        position: 'relative', overflow: 'visible',
        // Selection ring overrides the default focus ring; otherwise leave outline
        // untouched so the `:focus-visible` rule in styles.css can paint a green-glow
        // ring for keyboard navigation.
        outline: isSelected ? '2px solid #00ff00' : undefined,
        borderRadius: 4,
        boxShadow: isSelected ? '0 0 8px rgba(0,255,0,0.5)' : (TIER_GLOW[unit.cost] || 'none'),
        transition: animClass ? 'none' : 'transform 0.15s ease-out, opacity 0.15s',
        userSelect: 'none', touchAction: 'none',
        transformStyle: undefined,
      }}
    >
      {/* Flat shadow on the board plane (not counter-rotated) */}
      {isBoard && (
        <div style={{
          position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
          width: '80%', height: 8,
          background: 'rgba(0,0,0,0.4)', borderRadius: '50%',
          filter: 'blur(4px)', pointerEvents: 'none',
        }} />
      )}
      {/* Counter-rotate unit content so it faces the camera */}
      {isBoard ? (
        <div className="wt-iso-unit" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'visible',
        }}>
          {cardContent}
        </div>
      ) : cardContent}
    </div>
  );
}

/* ─── WtErrorBoundary ─── */
import { logError } from '../lib/logger.js';

export class WtErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Mirror to console + retain in the ring buffer so ProfilePanel can show it.
    logError(error, { boundary: 'WtErrorBoundary', componentStack: errorInfo?.componentStack || null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 32, maxWidth: 600, margin: '60px auto',
          background: 'rgba(40,0,0,0.9)', border: '2px solid #ff4444',
          borderRadius: 8, color: '#ff8888', fontFamily: 'monospace',
          textAlign: 'center',
        }}>
          <h2 style={{ color: '#ff4444', marginBottom: 12 }}>Wasteland Tactics - Critical Error</h2>
          <p style={{ color: '#ffaa88', marginBottom: 16 }}>Something went wrong in the wasteland...</p>
          <details style={{ textAlign: 'left', marginBottom: 16 }}>
            <summary style={{ cursor: 'pointer', color: '#ff6666' }}>Error Details</summary>
            <pre style={{
              fontSize: 11, color: '#ff8888', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              background: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 4, marginTop: 8,
              maxHeight: 300, overflow: 'auto',
            }}>
              {this.state.error?.toString()}
              {'\n\n'}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', fontSize: 16, fontWeight: 'bold',
              background: '#ff4444', color: '#fff', border: 'none',
              borderRadius: 4, cursor: 'pointer',
            }}
          >
            Reload Game
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
