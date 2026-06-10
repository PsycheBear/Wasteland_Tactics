// External stores for the two highest-frequency pieces of UI state.
//
// `combatTick` updates every 100ms during combat and `log` is appended to
// dozens of times per fight. As React state on the root Game component they
// re-rendered the ENTIRE tree (board, bench, shop, menus) on every update —
// the single biggest render bottleneck found in the June 2026 audit.
//
// As module-level stores, only the components that subscribe
// (CombatProgressBar, LogPanel) re-render. The setters keep the exact
// `setState` call signature — value or functional updater — so combat.js
// callbacks and Game.jsx call sites did not have to change.

import { useSyncExternalStore } from 'react';

function createStore(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set: (next) => {
      value = typeof next === 'function' ? next(value) : next;
      listeners.forEach((l) => l());
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const combatTickStore = createStore(0);
const logStore = createStore([]);

export const setCombatTick = combatTickStore.set;
export const setLog = logStore.set;
export const getLog = logStore.get;

export function useCombatTick() {
  return useSyncExternalStore(combatTickStore.subscribe, combatTickStore.get);
}

export function useGameLog() {
  return useSyncExternalStore(logStore.subscribe, logStore.get);
}
