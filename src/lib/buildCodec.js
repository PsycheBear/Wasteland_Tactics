// Build export/import codec.
//
// Serializes a minimal slice of game state (board / bench / augments / items)
// to a base64 string the player can copy to clipboard and paste later. Includes
// a version tag so future schema changes can reject incompatible builds with
// a clear error instead of silently mis-decoding.
//
// API:
//   encode({ board, bench, augments, items }) -> string   (base64 JSON)
//   decode(string) -> { version, board, bench, augments, items }
//   decode() throws Error on:
//     - non-string input
//     - bad base64
//     - non-object payload
//     - missing or mismatched version
//
// The exported codec is intentionally browser-only — it uses `btoa`/`atob`,
// which are globally available in modern browsers and in the jsdom env used
// by the test runner.

export const BUILD_VERSION = 1;

// Encode an arbitrary UTF-8 string into base64. `btoa` only handles latin-1,
// so we round-trip through encodeURIComponent / String.fromCharCode to be safe
// with unit names or augment descriptions containing emoji.
function utf8ToB64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64ToUtf8(str) {
  return decodeURIComponent(escape(atob(str)));
}

export function encode(state) {
  const payload = {
    version: BUILD_VERSION,
    board: Array.isArray(state?.board) ? state.board : [],
    bench: Array.isArray(state?.bench) ? state.bench : [],
    augments: Array.isArray(state?.augments) ? state.augments : [],
    items: Array.isArray(state?.items) ? state.items : [],
  };
  return utf8ToB64(JSON.stringify(payload));
}

export function decode(str) {
  if (typeof str !== 'string' || str.length === 0) {
    throw new Error('Build code must be a non-empty string');
  }
  let json;
  try {
    json = b64ToUtf8(str.trim());
  } catch (_) {
    throw new Error('Build code is not valid base64');
  }
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (_) {
    throw new Error('Build code payload is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Build code payload is not an object');
  }
  if (parsed.version !== BUILD_VERSION) {
    throw new Error(`Build code version mismatch (got ${parsed.version}, expected ${BUILD_VERSION})`);
  }
  return parsed;
}
