// Game state defaults + reducer scaffolding.
//
// This is intentionally a thin extraction: Game.jsx still owns most of its
// useState calls because they are entangled with refs, callbacks, and DOM
// effects scattered across ~4000 lines. Moving the entire state graph into a
// reducer in one pass risks regressions during a refactor that's required to
// preserve behavior exactly.
//
// What's here today:
//   - INITIAL_RUN_STATE: the canonical starting values used by `start a new run`
//   - newRunState(): factory returning a fresh copy (defensive clone of arrays)
//   - runReducer(): a small reducer covering the core round/level/hp/gold loop
//     and the augment offer modal. Extracted from Game.jsx so future waves can
//     migrate more actions in without rewriting the world.
//
// Game.jsx can call `useGameState()` to get state + dispatch for the actions it
// has been migrated to use; or it can pull just the constants for now.

import { useReducer } from 'react';

export const INITIAL_RUN_STATE = {
  round: 1,
  gold: 10,
  hp: 100,
  level: 3,
  xp: 0,
  xpNeeded: 4,
  streak: 0,
  board: Array(14).fill(null),
  bench: Array(9).fill(null),
  shop: [],
  augments: [],
  itemInventory: [],
};

// Factory used both by the reducer (RESET action) and by callers that want a
// blank slate without invoking the hook.
export function newRunState() {
  return {
    ...INITIAL_RUN_STATE,
    board: Array(14).fill(null),
    bench: Array(9).fill(null),
    shop: [],
    augments: [],
    itemInventory: [],
  };
}

export function runReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return newRunState();
    case 'SET_ROUND':
      return { ...state, round: action.round };
    case 'SET_HP':
      return { ...state, hp: action.hp };
    case 'SET_GOLD':
      return { ...state, gold: action.gold };
    case 'SET_LEVEL':
      return { ...state, level: action.level, xp: 0, xpNeeded: action.xpNeeded ?? state.xpNeeded };
    case 'ADD_AUGMENT':
      return { ...state, augments: [...state.augments, action.id] };
    case 'SET_BOARD':
      return { ...state, board: action.board };
    case 'SET_BENCH':
      return { ...state, bench: action.bench };
    case 'SET_SHOP':
      return { ...state, shop: action.shop };
    case 'SET_INVENTORY':
      return { ...state, itemInventory: action.items };
    case 'SET_STREAK':
      return { ...state, streak: action.streak };
    case 'PATCH':
      // Bulk update — useful for save/load round-trips.
      return { ...state, ...action.patch };
    default:
      return state;
  }
}

export function useGameState(initial) {
  return useReducer(runReducer, initial || newRunState());
}
