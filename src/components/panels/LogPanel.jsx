// Combat log panel + the bracket-tag => colored badge parser.
//
// Combat log lines emitted from combat.js (and a handful of UI helpers in
// Game.jsx) start with a bracketed tag token like `[VICTORY]` or `[GOLD]`.
// Each key here maps to a terminal-style prefix label + a badge color so
// the line is parsed and rendered with a colored monospace prefix.
//
// The previous emoji-keyed map was replaced with bracket tokens; the project
// no longer renders emoji glyphs anywhere. The export name is preserved
// (LOG_EMOJI_MAP) so future search&replace stays easy to grep, but the keys
// are deliberately ASCII-only.
//
// The panel subscribes to the log store directly so frequent log appends
// during combat only re-render this panel, not the whole game tree.

import React from 'react';
import { useGameLog } from '../../game/uiStores.js';

const LOG_EMOJI_MAP = {
  '[UP]':      { label: 'UP',    color: '#ffd700' },
  '[DEF]':     { label: 'DEF',   color: '#6688ff' },
  '[TECH]':    { label: 'TECH',  color: '#708090' },
  '[MED]':     { label: 'MED',   color: '#ff6666' },
  '[STIM]':    { label: 'MED',   color: '#ff8888' },
  '[DOG]':     { label: 'DOG',   color: '#cc8844' },
  '[DET]':     { label: 'DET',   color: '#aaaaff' },
  '[PSI]':     { label: 'PSI',   color: '#cc66ff' },
  '[FIRE]':    { label: 'FIRE',  color: '#ff6600' },
  '[STR]':     { label: 'STR',   color: '#ff6644' },
  '[ZAP]':     { label: 'ZAP',   color: '#ffff44' },
  '[CLAW]':    { label: 'CLAW',  color: '#66cc66' },
  '[LAB]':     { label: 'LAB',   color: '#44ff88' },
  '[NEWS]':    { label: 'NEWS',  color: '#ffcc44' },
  '[RAD]':     { label: 'RAD',   color: '#44ff44' },
  '[AIM]':     { label: 'AIM',   color: '#ffaa00' },
  '[RAGE]':    { label: 'RAGE',  color: '#ff4444' },
  '[HEAL]':    { label: 'HEAL',  color: '#2E8B57' },
  '[SPY]':     { label: 'SPY',   color: '#aa88cc' },
  '[BIO]':     { label: 'BIO',   color: '#669933' },
  '[GLOW]':    { label: 'BIO',   color: '#88cc44' },
  '[BOT]':     { label: 'BOT',   color: '#aaaaaa' },
  '[KILL]':    { label: 'KILL',  color: '#ff4444' },
  '[DEFEAT]':  { label: 'KILL',  color: '#ff4444' },
  '[USA]':     { label: 'USA',   color: '#4488ff' },
  '[BOSS]':    { label: 'BOSS',  color: '#ff4444' },
  '[PVE]':     { label: 'BOSS',  color: '#ff9966' },
  '[JET]':     { label: 'JET',   color: '#aaccff' },
  '[BOOM]':    { label: 'BOOM',  color: '#ffaa44' },
  '[VOID]':    { label: 'VOID',  color: '#cc66ff' },
  '[SHROUD]':  { label: 'VOID',  color: '#aa99cc' },
  '[SCOPE]':   { label: 'SCOPE', color: '#44ccff' },
  '[LASER]':   { label: 'LASER', color: '#ff4444' },
  '[CRIT]':    { label: 'CRIT',  color: '#ff8844' },
  '[GUN]':     { label: 'GUN',   color: '#aaaaaa' },
  '[BLADE]':   { label: 'BLADE', color: '#ff8844' },
  '[WEAVE]':   { label: 'WEAVE', color: '#cccccc' },
  '[FIX]':     { label: 'FIX',   color: '#aaaaaa' },
  '[DODGE]':   { label: 'DODGE', color: '#aa66ff' },
  '[WIN]':     { label: 'WIN',   color: '#ffd700' },
  '[VICTORY]': { label: 'WIN',   color: '#ffd700' },
  '[LUCKY]':   { label: 'WIN',   color: '#ffd700' },
  '[ITEM]':    { label: 'ITEM',  color: '#ffaa00' },
  '[GIFT]':    { label: 'ITEM',  color: '#ffaa00' },
  '[CAPS]':    { label: 'CAPS',  color: '#ffd700' },
  '[GOLD]':    { label: 'CAPS',  color: '#ffd700' },
  '[XP]':      { label: 'UP',    color: '#88ff88' },
  '[WARN]':    { label: 'WARN',  color: '#ffaa00' },
  '[SAVE]':    { label: 'SAVE',  color: '#44aaff' },
};

/* Terminal-style log prefixes based on tag category */
const TERMINAL_PREFIX = {
  KILL: { prefix: '[KILL]', color: '#ff4444' },
  HEAL: { prefix: '[HEAL]', color: '#44cc88' },
  CRIT: { prefix: '[CRIT]', color: '#ffaa00' },
  ZAP:  { prefix: '[ZAP]',  color: '#cc8800' },
  FIRE: { prefix: '[FIRE]', color: '#ff6600' },
  BOSS: { prefix: '[BOSS]', color: '#ff4444' },
  WIN:  { prefix: '[SYS]',  color: '#c8942a' },
  SAVE: { prefix: '[SYS]',  color: '#c8942a' },
  WARN: { prefix: '[SYS]',  color: '#c8942a' },
  ITEM: { prefix: '[ITEM]', color: '#ffaa00' },
  CAPS: { prefix: '[CAPS]', color: '#ffd700' },
  UP:   { prefix: '[UP]',   color: '#ffd700' },
  DEF:  { prefix: '[DEF]',  color: '#6688ff' },
  TECH: { prefix: '[TECH]', color: '#708090' },
  MED:  { prefix: '[MED]',  color: '#44cc88' },
  DOG:  { prefix: '[ATK]',  color: '#cc8844' },
  DET:  { prefix: '[DET]',  color: '#aaaaff' },
  PSI:  { prefix: '[PSI]',  color: '#cc66ff' },
  STR:  { prefix: '[STR]',  color: '#ff6644' },
  CLAW: { prefix: '[ATK]',  color: '#66cc66' },
  NEWS: { prefix: '[DBF]',  color: '#ffcc44' },
  AIM:  { prefix: '[AIM]',  color: '#ffaa00' },
  RAGE: { prefix: '[DBF]',  color: '#ff4444' },
  SPY:  { prefix: '[SPY]',  color: '#aa88cc' },
  BIO:  { prefix: '[RAD]',  color: '#669933' },
  BOT:  { prefix: '[BOT]',  color: '#aaaaaa' },
  USA:  { prefix: '[USA]',  color: '#4488ff' },
  JET:  { prefix: '[JET]',  color: '#aaccff' },
  BOOM: { prefix: '[BOOM]', color: '#ffaa44' },
  VOID: { prefix: '[VOID]', color: '#cc66ff' },
  SCOPE:{ prefix: '[AIM]',  color: '#44ccff' },
  LASER:{ prefix: '[FIRE]', color: '#ff4444' },
  GUN:  { prefix: '[GUN]',  color: '#aaaaaa' },
  BLADE:{ prefix: '[ATK]',  color: '#ff8844' },
  WEAVE:{ prefix: '[DEF]',  color: '#cccccc' },
  FIX:  { prefix: '[FIX]',  color: '#aaaaaa' },
  DODGE:{ prefix: '[MISS]', color: '#aa66ff' },
};
// Map existing label → terminal prefix
const LABEL_TO_TERMINAL = {};
for (const [, v] of Object.entries(LOG_EMOJI_MAP)) {
  LABEL_TO_TERMINAL[v.label] = TERMINAL_PREFIX[v.label] || { prefix: '>', color: '#33ff33' };
}
// Sort tokens by length descending so `[DEFEAT]` is tried before `[DEF]`
// (otherwise the shorter prefix would shadow the longer token).
const LOG_EMOJI_ENTRIES = Object.entries(LOG_EMOJI_MAP).sort(
  ([a], [b]) => b.length - a.length,
);

let logActionCounter = 0;
export function formatLogEntry(text, roundNum) {
  if (!text || typeof text !== 'string') return text;
  logActionCounter++;
  const ts = `[R${roundNum || '?'}-${String(logActionCounter % 100).padStart(2, '0')}]`;

  for (const [token, style] of LOG_EMOJI_ENTRIES) {
    if (text.startsWith(token)) {
      const rest = text.slice(token.length).trimStart();
      const tp = LABEL_TO_TERMINAL[style.label] || { prefix: '>', color: 'var(--ui-primary)' };
      return React.createElement('span', { style: { fontFamily: "'Share Tech Mono', monospace" } },
        React.createElement('span', { style: { color: 'var(--ui-text-dim)', fontSize: 8, marginRight: 4, opacity: 0.5 } }, ts),
        React.createElement('span', { style: { color: tp.color, fontWeight: 'bold', marginRight: 4, fontSize: 9 } }, tp.prefix),
        React.createElement('span', { style: { color: 'var(--ui-text)' } }, rest)
      );
    }
  }
  return React.createElement('span', { style: { fontFamily: "'Share Tech Mono', monospace" } },
    React.createElement('span', { style: { color: 'var(--ui-text-dim)', fontSize: 8, marginRight: 4, opacity: 0.5 } }, ts),
    React.createElement('span', { style: { color: 'var(--ui-secondary)', marginRight: 4 } }, '>'),
    React.createElement('span', { style: { color: 'var(--ui-text)' } }, text)
  );
}

export default function LogPanel({ round }) {
  const log = useGameLog();
  return (
    <div className="wt-log-panel" style={{ flex: 1, fontSize: 11, overflow: 'auto' }}>
      {log.map((l, i) => (
        <div key={i} className="wt-log-entry" style={{ padding: '3px 0', opacity: Math.max(0.3, 1 - i * 0.05), lineHeight: 1.5 }}>
          {formatLogEntry(l, round)}
        </div>
      ))}
      {!log.length && <div className="wt-log-empty">Awaiting orders<span className="wt-terminal-cursor">█</span></div>}
    </div>
  );
}
