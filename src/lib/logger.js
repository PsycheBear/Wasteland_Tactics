// Minimal error logger.
//
// Keeps the last 20 logged errors in a module-level ring buffer and mirrors them
// to `console.error`. No external telemetry: this is purely a local store the
// ProfilePanel can render for debugging.
//
// Usage:
//   import { logError, getRecentErrors, clearRecentErrors } from '../lib/logger.js';
//   try { ... } catch (e) { logError(e, { where: 'combat-tick' }); }
//
// Each stored entry is shaped like:
//   { time: number, message: string, stack: string|null, context: any }

const MAX_ENTRIES = 20;
const buffer = [];

export function logError(err, context = null) {
  let message, stack = null;
  if (err instanceof Error) {
    message = err.message;
    stack = err.stack || null;
  } else if (typeof err === 'string') {
    message = err;
  } else {
    try { message = JSON.stringify(err); } catch (_) { message = String(err); }
  }
  const entry = { time: Date.now(), message, stack, context };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  // Always mirror to console — devtools is the real-time debugger.
  // eslint-disable-next-line no-console
  console.error('[wt]', message, context ?? '', stack || '');
  return entry;
}

export function getRecentErrors() {
  // Return a defensive copy so callers can't mutate the ring buffer.
  return buffer.slice();
}

export function clearRecentErrors() {
  buffer.length = 0;
}
