/**
 * Fallout 4 Local Audio Loader
 *
 * Reads extracted FO4 sounds from ~/.wasteland-tactics-audio/ at runtime.
 * These files are NEVER committed to the repo — they stay local.
 * Falls back to existing audio (downloaded files or Web Audio synthesis) if FO4 files missing.
 *
 * The Vite dev server can't serve files from outside public/, so we create
 * object URLs from fetch() of the local file system via the dev server proxy,
 * or use the Electron/Tauri file:// protocol if available.
 */

// Map of game audio method → FO4 cache file path
const FO4_SOUND_MAP = {
  // UI Sounds
  click:         'ui/pipboy-click.wav',
  hover:         'ui/pipboy-dial.wav',
  tabSwitch:     'ui/pipboy-tab.wav',
  toggleSwitch:  'ui/pipboy-select.wav',
  sliderTick:    'ui/pipboy-dial.wav',
  deny:          'ui/pipboy-deselect.wav',
  experienceUp:  'ui/experience-up.wav',
  levelUp:       'music/level-up.wav',
  capsEarn:      'ui/caps-earn.wav',
  capsSpend:     'ui/caps-spend.wav',

  // VATS / Combat transitions
  combatStart:   'ui/vats-enter.wav',
  criticalHit:   'ui/vats-critical.wav',

  // Weapons — Ballistic
  gunshot:       'combat/pistol-10mm.wav',

  // Weapons — Energy
  laserZap:      'combat/laser-pistol.wav',

  // Weapons — Melee
  meleeHit:      'combat/sledgehammer.wav',

  // Weapons — Explosive
  explosion:     'combat/nuke-explosion.wav',

  // Impacts
  hit:           'combat/bullet-impact.wav',
  crit:          'combat/bullet-impact2.wav',

  // Deathclaw
  // (deathclaw melee uses combat/deathclaw-melee.wav)

  // Death / Kill
  death:         'combat/explosive-impact.wav',
  killConfirm:   'ui/discover-location.wav',

  // Victory / Defeat
  victory:       'music/level-up.wav',
  defeat:        'ui/vats-exit.wav',

  // Geiger / Radiation
  geigerTick:    'fx/geiger-counter.wav',

  // Vault door
  vaultDoor:     'fx/vault-door-open.wav',

  // Fat Man
  abilityAoe:    'combat/fat-man-fire.wav',

  // Gauss
  abilityBuff:   'combat/gauss-impact.wav',
};

// Cache of loaded audio buffers (URL -> Audio element pool)
const audioCache = {};
const POOL_SIZE = 3; // Max concurrent plays per sound

/**
 * Get the FO4 audio cache directory.
 * On Windows: C:\Users\{user}\.wasteland-tactics-audio\
 */
function getCacheDir() {
  // Check localStorage for custom path
  try {
    const custom = localStorage.getItem('wt_fo4_audio_path');
    if (custom) return custom;
  } catch(_) {}

  // Default: user home directory
  // In a browser context we can't access the filesystem directly,
  // so we use Vite's proxy or Tauri's asset protocol
  return null;
}

/**
 * Try to load a FO4 sound file. Returns a function that plays it, or null.
 * Uses Tauri's convertFileSrc or falls back to file:// protocol.
 */
function createFO4Player(relativePath) {
  // Build the full file URL
  const homeDir = getHomeDir();
  if (!homeDir) return null;

  const fullPath = `${homeDir}/.wasteland-tactics-audio/${relativePath}`;
  const fileUrl = `file:///${fullPath.replace(/\\/g, '/')}`;

  return (volume = 0.5) => {
    try {
      // Reuse from pool or create new
      const key = relativePath;
      if (!audioCache[key]) {
        audioCache[key] = [];
      }

      // Find available audio element in pool
      let audio = audioCache[key].find(a => a.paused || a.ended);
      if (!audio && audioCache[key].length < POOL_SIZE) {
        audio = new Audio(fileUrl);
        audioCache[key].push(audio);
      } else if (!audio) {
        // All in use, reuse oldest
        audio = audioCache[key][0];
        audio.currentTime = 0;
      }

      audio.volume = Math.max(0.01, volume);
      const p = audio.play();
      if (p) p.catch(() => {});
      return true;
    } catch(_) {
      return false;
    }
  };
}

/**
 * Get user's home directory from environment.
 * Works in Tauri/Electron. In pure browser, uses a best-guess.
 */
function getHomeDir() {
  // Check if we have a stored path
  try {
    const stored = localStorage.getItem('wt_fo4_cache_dir');
    if (stored) return stored;
  } catch(_) {}

  // Try common Windows paths
  if (typeof window !== 'undefined') {
    // In Tauri, we might have __TAURI__
    if (window.__TAURI__) {
      return null; // Tauri uses its own asset protocol
    }
  }

  // For Vite dev server, we need a different approach —
  // serve the cache dir as a static asset via vite config
  return null;
}

/**
 * Check if FO4 audio cache exists and is populated.
 */
export function checkFO4Audio() {
  // In a browser, we can't check the filesystem directly.
  // Instead, we try to fetch a known file and see if it works.
  return new Promise((resolve) => {
    const testFile = '/fo4-audio/ui/pipboy-click.wav';
    fetch(testFile, { method: 'HEAD' })
      .then(r => resolve(r.ok))
      .catch(() => resolve(false));
  });
}

/**
 * Create a FO4-aware sound player for a specific method.
 * Tries /fo4-audio/{path} (served by Vite proxy), falls back to provided fallback.
 */
export function createFO4Sound(methodName, fallbackFn, volume = 0.5) {
  const path = FO4_SOUND_MAP[methodName];
  if (!path) return fallbackFn;

  const url = `/fo4-audio/${path}`;
  let tested = false;
  let available = false;

  return () => {
    if (!tested) {
      tested = true;
      // Test if file exists (async, first call uses fallback)
      fetch(url, { method: 'HEAD' })
        .then(r => { available = r.ok; })
        .catch(() => { available = false; });
      if (fallbackFn) fallbackFn();
      return;
    }

    if (available) {
      try {
        const key = methodName;
        if (!audioCache[key]) audioCache[key] = [];
        let audio = audioCache[key].find(a => a.paused || a.ended);
        if (!audio && audioCache[key].length < POOL_SIZE) {
          audio = new Audio(url);
          audioCache[key].push(audio);
        } else if (!audio) {
          audio = audioCache[key][0];
          audio.currentTime = 0;
        }
        if (audio) {
          audio.volume = Math.max(0.01, volume);
          audio.play().catch(() => { if (fallbackFn) fallbackFn(); });
        }
      } catch(_) {
        if (fallbackFn) fallbackFn();
      }
    } else {
      if (fallbackFn) fallbackFn();
    }
  };
}

export { FO4_SOUND_MAP };
