import React from 'react';
import { UNIT_DATABASE } from '../data/units.js';
import { TRAITS } from '../data/traits.js';
import { ITEM_COMPONENTS, COMPLETED_ITEMS } from '../data/items.js';
import { COST_COLORS } from '../data/constants.js';
import { IMAGES } from '../data/images.js';

/* ─── helpers ─── */
const getColor = (cost) => COST_COLORS[cost] || '#888';
const stars = (n) => '⭐'.repeat(n);
const getUnitImage = (unitId, starLevel) => {
  const img = IMAGES[unitId]?.[starLevel] || IMAGES[unitId]?.[1];
  return img || null;
};

/* ─── CombatBars ─── */
export function CombatBars({ currentHp, maxHp, mana, manaMax, variant = 'ally', compact = false }) {
  const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;
  const manaPct = manaMax > 0 ? Math.max(0, Math.min(100, (mana / manaMax) * 100)) : 0;
  const manaFull = mana >= manaMax;

  const barWidth = compact ? 50 : 60;
  const barHeight = compact ? 5 : 7;

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
      </div>
      {/* AP / Mana bar */}
      <div style={{
        width: '100%', height: barHeight - 1, background: 'rgba(0,0,60,0.6)',
        borderRadius: 2, overflow: 'hidden', position: 'relative',
        boxShadow: manaFull ? '0 0 6px rgba(0,150,255,0.8)' : 'none',
      }}>
        <div style={{
          width: `${manaPct}%`, height: '100%',
          background: manaFull ? '#00ccff' : '#4488ff',
          borderRadius: 2, transition: 'width 0.2s ease',
        }} />
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
  if (!unitTooltip) return null;
  const { unit, x, y } = unitTooltip;
  const db = UNIT_DATABASE[unit.id] || {};

  // Gather item info
  const equippedItems = unit.items || [];

  return (
    <>
      {/* Backdrop to close on click */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 3000, background: 'transparent',
      }} />
      <div style={{
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
              <span key={t} style={{ marginRight: 6, color: trait.color }}>
                {trait.icon} {trait.name}
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
                  {item.icon} {item.name} — <span style={{ color: '#999' }}>{item.desc}</span>
                </div>
              ) : null;
            })}
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
  selectedItem,
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
  const animClass = isAbility ? 'wt-anim-ability' : isDying ? 'wt-anim-dying' : isHit ? 'wt-anim-hit' : isAttacking ? 'wt-anim-attack' : '';

  const imgSize = small ? 48 : 56;
  const unitImg = getUnitImage(unit.id, unit.stars);

  // Item badges
  const equippedItems = unit.items || [];

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
        outline: isSelected ? '2px solid #00ff00' : 'none',
        borderRadius: 4,
        transition: animClass ? 'none' : 'transform 0.15s ease-out, opacity 0.15s',
        userSelect: 'none', touchAction: 'none',
      }}
    >
      {/* Cost color top border */}
      <div style={{
        position: 'absolute', top: -2, left: 0, right: 0, height: 3,
        background: getColor(unit.cost), borderRadius: '4px 4px 0 0',
      }} />

      {/* Unit image or placeholder */}
      {unitImg ? (
        <img
          src={unitImg} alt={unit.name}
          draggable={false}
          style={{
            width: imgSize, height: imgSize,
            objectFit: unit.id === 'nick' ? 'cover' : 'contain',
            borderRadius: unit.id === 'nick' ? '50%' : undefined,
            pointerEvents: 'none',
          }}
        />
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
                {item.icon}
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
    </div>
  );
}

/* ─── WtErrorBoundary ─── */
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
    console.error('WtErrorBoundary caught:', error, errorInfo);
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
