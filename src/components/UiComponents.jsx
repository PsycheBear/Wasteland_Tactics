import React from 'react';
import { UNIT_DATABASE } from '../data/units.js';
import { TRAITS } from '../data/traits.js';
import { ITEM_COMPONENTS, COMPLETED_ITEMS } from '../data/items.js';
import { COST_COLORS } from '../data/constants.js';
import { LORE } from '../data/lore.js';
import { GameIcon } from './GameIcon.jsx';
import { getWeaponType, IDLE_CLASSES } from '../systems/unitTypes.js';
import { IMAGES } from '../data/images.js';

/* ─── PortraitImg ─── tries the unit's external portrait PNG first; on error,
 * falls back to the existing IMAGES data URL; on error again, the caller renders
 * a placeholder (UnitPlaceholder). */
export function PortraitImg({ unitId, starLevel, size, alt }) {
  const portrait = UNIT_DATABASE[unitId]?.portrait;
  const dataUrl = IMAGES[unitId]?.[starLevel] || IMAGES[unitId]?.[1] || null;
  const initial = portrait || dataUrl;
  const [src, setSrc] = React.useState(initial);
  React.useEffect(() => { setSrc(portrait || dataUrl); }, [portrait, dataUrl]);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onError={() => {
        if (src === portrait && dataUrl) setSrc(dataUrl);
        else setSrc(null);
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
  const { unit, x, y } = unitTooltip;
  const db = UNIT_DATABASE[unit.id] || {};
  const loreText = LORE.units?.[unit.id];

  // Gather item info
  const equippedItems = unit.items || [];

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
        style={{
        position: 'fixed', left: Math.min(x, window.innerWidth - 280), top: Math.min(y, window.innerHeight - 350),
        zIndex: 3001, background: 'rgba(20,20,20,0.95)', border: '2px solid #ffd700',
        borderRadius: 6, padding: 12, minWidth: 240, maxWidth: 300,
        color: '#eee', fontSize: 13, boxShadow: '0 0 20px rgba(255,215,0,0.3)',
        pointerEvents: 'auto',
      }}>
        {/* Name + stars */}
        <div style={{ fontSize: 16, fontWeight: 'bold', color: getColor(unit.cost), marginBottom: 4 }}>
          {unit.name} {stars(unit.stars)}
        </div>

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

  // Item badges
  const equippedItems = unit.items || [];

  const cardContent = (
    <>
      {/* Cost color top border */}
      <div style={{
        position: 'absolute', top: -2, left: 0, right: 0, height: 3,
        background: getColor(unit.cost), borderRadius: '4px 4px 0 0',
      }} />

      {/* Unit portrait (PNG) → IMAGES data URL → placeholder fallback chain */}
      {(UNIT_DATABASE[unit.id]?.portrait || unitImg) ? (
        <PortraitImg unitId={unit.id} starLevel={unit.stars} size={imgSize} alt={unit.name} />
      ) : (
        <UnitPlaceholder name={unit.name} size={imgSize} />
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
