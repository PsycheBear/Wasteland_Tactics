// Vite sets BASE_URL from vite.config.js `base` (e.g. '/Wasteland_Tactics/').
// Trailing slash stripped so usages like `${BASE}/audio/foo.mp3` produce
// '/Wasteland_Tactics/audio/foo.mp3' in production and '/audio/foo.mp3' in dev.
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
