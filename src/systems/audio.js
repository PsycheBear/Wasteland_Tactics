// Sound system using Web Audio API
// Sound system – Fallout / Pip-Boy themed (retro sci-fi, mechanical, warm)
import { BASE } from '../baseUrl.js';
export const WT_SETTINGS = { volume: 1, musicVolume: 1, sfxVolume: 1, uiSoundVolume: 1, ambientVolume: 1, animationSpeed: 1, scanlines: true, phosphor: true, crtMode: false };
export const createSound = (getVol = () => WT_SETTINGS.volume) => {
  let audioCtx = null;
  let prepMusic = null;
  let battleMusic = null;
  let casinoMusic = null;
  let bossMusic = null;
  
  const getAudioContext = () => {
    if (!audioCtx && typeof window !== 'undefined') {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  };
  
  // Retro synth tone – triangle for warmth, lowpass for CRT/analog feel
  const playTone = (freq, duration, type = 'square', volume = 0.2) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;
      filter.Q.value = 0.3;
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = Math.max(0.001, volume * getVol());
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
      osc.onended = () => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch(_){} };
    } catch(_) {}
  };

  // Richer layered tone – two oscillators detuned for fatness
  const playRichTone = (freq, duration, type = 'square', volume = 0.15) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      const vol = Math.max(0.001, volume * getVol());
      // Main oscillator
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, t);
      filter.frequency.exponentialRampToValueAtTime(400, t + duration);
      filter.Q.value = 1.5;
      osc1.type = type;
      osc1.frequency.value = freq;
      osc2.type = type === 'square' ? 'triangle' : type;
      osc2.frequency.value = freq * 1.005; // slight detune
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc1.connect(filter); osc2.connect(filter);
      filter.connect(gain); gain.connect(ctx.destination);
      osc1.start(t); osc2.start(t);
      osc1.stop(t + duration); osc2.stop(t + duration);
      osc2.onended = () => { try { osc1.disconnect(); osc2.disconnect(); filter.disconnect(); gain.disconnect(); } catch(_){} };
    } catch(_) {}
  };

  // Noise burst for impacts
  const playNoise = (duration = 0.04, volume = 0.12, filterFreq = 3000) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * duration);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq;
      filter.Q.value = 0.8;
      gain.gain.setValueAtTime(Math.max(0.001, volume * getVol()), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start(t);
      src.stop(t + duration);
      src.onended = () => { try { src.disconnect(); filter.disconnect(); gain.disconnect(); } catch(_){} };
    } catch(_) {}
  };

  // Pip-Boy style mechanical click – snappy transient with subtle body
  const playClick = () => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      // Short noise transient
      const len = Math.floor(ctx.sampleRate * 0.018);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.2));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2500;
      filter.Q.value = 1.2;
      gain.gain.setValueAtTime(Math.max(0.001, 0.15 * getVol()), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(t);
      // Subtle tonal body
      const osc = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.02);
      g2.gain.setValueAtTime(Math.max(0.001, 0.08 * getVol()), t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
      osc.connect(g2); g2.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.025);
      osc.onended = () => { try { osc.disconnect(); g2.disconnect(); src.disconnect(); filter.disconnect(); gain.disconnect(); } catch(_){} };
    } catch(_) {}
  };

  // Noise sweep — noise burst with filter frequency ramp (for whooshes, sweeps)
  const playNoiseSweep = (duration = 0.15, volume = 0.1, startFreq = 4000, endFreq = 500, filterQ = 1.0) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * duration);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
      const src2 = ctx.createBufferSource();
      src2.buffer = buf;
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(startFreq, t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
      filter.Q.value = filterQ;
      gain.gain.setValueAtTime(Math.max(0.001, volume * getVol()), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      src2.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src2.start(t);
      src2.stop(t + duration);
      src2.onended = () => { try { src2.disconnect(); filter.disconnect(); gain.disconnect(); } catch(_){} };
    } catch(_) {}
  };

  // Frequency sweep oscillator — for zaps, sirens, sweeps
  const playFreqSweep = (startFreq, endFreq, duration, type = 'sine', volume = 0.15) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
      gain.gain.setValueAtTime(Math.max(0.001, volume * getVol()), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + duration);
      osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(_){} };
    } catch(_) {}
  };

  const playAudio = (src) => {
    try {
      const audio = new Audio(src);
      audio.volume = Math.max(0.01, 0.5 * getVol());
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } catch(e) {
      /* audio error - silent in production */
    }
  };

  // File-based audio: try MP3 first, fall back to synthesis
  const playFile = (path, volume = 0.5, fallbackFn = null) => {
    try {
      const audio = new Audio(path);
      audio.volume = Math.max(0.01, volume * getVol());
      const p = audio.play();
      if (p) p.catch(() => { if (fallbackFn) fallbackFn(); });
    } catch(_) {
      if (fallbackFn) fallbackFn();
    }
  };

  return {
    buy: () => {
      playClick();
      playRichTone(360, 0.08, 'square', 0.12);
      setTimeout(() => playRichTone(480, 0.09, 'square', 0.14), 55);
      setTimeout(() => playTone(720, 0.05, 'triangle', 0.06), 110);
    },
    spendCaps: () => {
      playClick();
      playNoise(0.02, 0.06, 4000);
      playRichTone(520, 0.05, 'square', 0.1);
      setTimeout(() => playRichTone(400, 0.06, 'square', 0.1), 40);
      setTimeout(() => playRichTone(300, 0.07, 'square', 0.08), 85);
      setTimeout(() => playTone(250, 0.04, 'triangle', 0.05), 130);
    },
    purchaseCurrency: () => {
      // Rewarding cascade — ascending chime with coin shower
      playRichTone(400, 0.1, 'triangle', 0.15);
      setTimeout(() => playRichTone(500, 0.1, 'triangle', 0.15), 80);
      setTimeout(() => playRichTone(600, 0.1, 'triangle', 0.15), 160);
      setTimeout(() => playRichTone(800, 0.15, 'triangle', 0.18), 240);
      // Coin shower — rapid high clicks
      for (let i = 0; i < 6; i++) {
        setTimeout(() => { playTone(1200 + Math.random() * 400, 0.03, 'sine', 0.06); playNoise(0.01, 0.02, 6000); }, 300 + i * 50);
      }
      // Final sparkle
      setTimeout(() => playRichTone(1000, 0.2, 'sine', 0.1), 600);
      setTimeout(() => playTone(1200, 0.15, 'sine', 0.06), 700);
    },
    sell: () => {
      playClick();
      playNoise(0.025, 0.08, 2000);
      playRichTone(240, 0.09, 'sawtooth', 0.12);
      setTimeout(() => playRichTone(180, 0.12, 'sawtooth', 0.1), 65);
      setTimeout(() => playTone(120, 0.08, 'triangle', 0.06), 140);
    },
    upgrade: () => {
      playClick();
      playRichTone(280, 0.06, 'square', 0.1);
      setTimeout(() => playRichTone(350, 0.06, 'square', 0.12), 50);
      setTimeout(() => playRichTone(440, 0.08, 'square', 0.14), 100);
      setTimeout(() => { playTone(660, 0.06, 'triangle', 0.08); playTone(880, 0.1, 'sine', 0.04); }, 155);
    },
    victory: () => {
      const synthFallback = () => {
        playRichTone(330, 0.12, 'square', 0.14);
        setTimeout(() => playRichTone(415, 0.12, 'square', 0.15), 80);
        setTimeout(() => playRichTone(523, 0.14, 'square', 0.16), 165);
        setTimeout(() => { playRichTone(659, 0.2, 'square', 0.18); playTone(1318, 0.15, 'sine', 0.04); }, 250);
        setTimeout(() => playTone(659, 0.3, 'triangle', 0.06), 380);
      };
      playFile(`${BASE}/audio/sfx/ui/victory-fanfare.mp3`, 0.5, synthFallback);
    },
    defeat: () => {
      const synthFallback = () => {
        playNoise(0.06, 0.1, 800);
        playRichTone(165, 0.18, 'sawtooth', 0.14);
        setTimeout(() => playRichTone(123, 0.22, 'sawtooth', 0.12), 120);
        setTimeout(() => playRichTone(82, 0.3, 'sawtooth', 0.1), 260);
      };
      playFile(`${BASE}/audio/sfx/ui/defeat-jingle.mp3`, 0.5, synthFallback);
    },
    click: () => playClick(),
    fight: () => {
      playNoise(0.04, 0.12, 1500);
      playRichTone(110, 0.07, 'sawtooth', 0.14);
      setTimeout(() => playRichTone(138, 0.07, 'sawtooth', 0.15), 55);
      setTimeout(() => playRichTone(165, 0.09, 'sawtooth', 0.16), 115);
      setTimeout(() => playNoise(0.03, 0.08, 2500), 170);
    },
    ability: () => {
      playTone(392, 0.04, 'triangle', 0.08);
      playRichTone(392, 0.06, 'square', 0.12);
      setTimeout(() => playRichTone(523, 0.07, 'square', 0.14), 40);
      setTimeout(() => { playRichTone(659, 0.08, 'square', 0.15); playTone(1318, 0.06, 'sine', 0.03); }, 85);
      setTimeout(() => playNoise(0.02, 0.04, 5000), 130);
    },
    experienceUp: () => {
      try {
        const sfx = new Audio(`${BASE}/audio/experience-up.mp3`);
        sfx.volume = 0.5 * getVol();
        sfx.play().catch(() => {});
      } catch(_) {}
    },
    startPrepMusic: () => {
      try {
        if (!prepMusic) {
          prepMusic = new Audio(`${BASE}/audio/prep-music.mp3`);
          prepMusic.loop = true;
        }
        prepMusic.volume = Math.max(0.01, 0.3 * getVol());
        prepMusic.play().catch(() => {});
      } catch(_) {}
    },
    stopPrepMusic: () => {
      try {
        if (prepMusic) {
          prepMusic.pause();
          prepMusic.currentTime = 0;
        }
      } catch(_) {}
    },
    startBattleMusic: () => {
      try {
        if (!battleMusic) {
          battleMusic = new Audio(`${BASE}/audio/battle-music.m4a`);
          battleMusic.loop = true;
        }
        battleMusic.volume = Math.max(0.01, 0.3 * getVol());
        battleMusic.play().catch(() => {});
      } catch(_) {}
    },
    stopBattleMusic: () => {
      try {
        if (battleMusic) {
          battleMusic.pause();
          battleMusic.currentTime = 0;
        }
      } catch(_) {}
    },
    hit: () => {
      // Short punchy impact — white noise burst, low-pass filtered, ~50ms
      playNoise(0.05, 0.10, 1800);
      playTone(120, 0.04, 'sine', 0.06);
    },
    crit: () => {
      // Sharper, louder hit with extra sine bite
      playNoise(0.05, 0.14, 2400);
      playTone(180, 0.05, 'sine', 0.10);
      playTone(360, 0.04, 'triangle', 0.06);
    },
    death: () => {
      // Low thud + fade — sine 100hz decaying over 200ms
      playTone(100, 0.20, 'sine', 0.14);
      playNoise(0.06, 0.08, 600);
    },
    startCombat: () => {
      // Alert/horn — sawtooth sweep 220→440hz, 300ms
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const t = ctx.currentTime;
        const vol = Math.max(0.001, 0.14 * getVol());
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1400;
        filter.Q.value = 0.5;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.linearRampToValueAtTime(440, t + 0.3);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.setValueAtTime(vol, t + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
        osc.onended = () => { try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch(_){} };
      } catch(_) {}
    },
    terminalOpen: () => {
      playTone(440, 0.05, 'sine', 0.2);
      setTimeout(() => playTone(880, 0.05, 'sine', 0.2), 50);
    },
    terminalTab: () => {
      playNoise(0.02, 0.15, 4000);
    },
    updateVolume: () => {
      const mv = WT_SETTINGS.musicVolume !== undefined ? WT_SETTINGS.musicVolume : 1;
      if (prepMusic) prepMusic.volume = Math.max(0.01, 0.3 * getVol() * mv);
      if (battleMusic) battleMusic.volume = Math.max(0.01, 0.3 * getVol() * mv);
      if (casinoMusic) casinoMusic.volume = Math.max(0.01, 0.25 * getVol() * mv);
      if (bossMusic) bossMusic.volume = Math.max(0.01, 0.3 * getVol() * mv);
    },

    // ───────────────────────── UI Sounds ─────────────────────────

    hover: () => {
      try { playNoise(0.01, 0.03, 6000); } catch(_) {}
    },

    deny: () => {
      try {
        playTone(120, 0.1, 'sawtooth', 0.15);
        setTimeout(() => playTone(90, 0.08, 'sawtooth', 0.12), 50);
      } catch(_) {}
    },

    levelUp: () => {
      try {
        // C-E-G-C ascending fanfare
        playTone(262, 0.25, 'triangle', 0.15);
        setTimeout(() => playTone(330, 0.25, 'triangle', 0.16), 300);
        setTimeout(() => playTone(392, 0.25, 'triangle', 0.17), 600);
        setTimeout(() => {
          playRichTone(523, 0.4, 'triangle', 0.2);
          playTone(1046, 0.3, 'sine', 0.06);
        }, 900);
      } catch(_) {}
    },

    synergize: () => {
      try {
        // Rising sweep
        playFreqSweep(200, 1200, 0.3, 'sine', 0.12);
        // Sparkle chime
        setTimeout(() => playTone(1200, 0.08, 'sine', 0.1), 200);
        setTimeout(() => playTone(1600, 0.06, 'sine', 0.08), 260);
        setTimeout(() => playTone(2000, 0.1, 'sine', 0.06), 310);
      } catch(_) {}
    },

    synergizeOff: () => {
      try {
        playFreqSweep(800, 200, 0.2, 'sine', 0.08);
      } catch(_) {}
    },

    tabSwitch: () => {
      try {
        playNoise(0.03, 0.08, 4000);
        playTone(600, 0.02, 'square', 0.06);
      } catch(_) {}
    },

    toggleSwitch: () => {
      try {
        playNoise(0.008, 0.12, 5000);
        setTimeout(() => playTone(80, 0.03, 'sine', 0.1), 10);
      } catch(_) {}
    },

    sliderTick: () => {
      try { playNoise(0.005, 0.02, 5000); } catch(_) {}
    },

    equipItem: () => {
      try {
        // Magazine load — two short transients
        playNoise(0.015, 0.1, 3000);
        setTimeout(() => {
          playNoise(0.02, 0.12, 2500);
          playTone(150, 0.03, 'sine', 0.06);
        }, 60);
      } catch(_) {}
    },

    craftItem: () => {
      try {
        // Metallic hammering
        playNoise(0.03, 0.12, 3500);
        setTimeout(() => playNoise(0.025, 0.1, 3200), 120);
        setTimeout(() => playNoise(0.02, 0.1, 3800), 230);
        // Completion ding
        setTimeout(() => {
          playTone(880, 0.15, 'triangle', 0.12);
          playTone(1320, 0.1, 'sine', 0.05);
        }, 450);
      } catch(_) {}
    },

    pickupUnit: () => {
      try {
        playNoiseSweep(0.12, 0.08, 500, 3000, 0.8);
      } catch(_) {}
    },

    placeUnit: () => {
      try {
        playTone(60, 0.12, 'sine', 0.15);
        playNoise(0.04, 0.1, 800);
      } catch(_) {}
    },

    invalidAction: () => {
      try {
        playTone(120, 0.06, 'sawtooth', 0.12);
      } catch(_) {}
    },

    capsEarn: () => {
      const synthFallback = () => {
        try {
          playNoise(0.01, 0.08, 5000);
          playTone(800, 0.06, 'sine', 0.1);
          setTimeout(() => playTone(1000, 0.04, 'sine', 0.06), 30);
        } catch(_) {}
      };
      playFile(`${BASE}/audio/easter-eggs/cap-ting.mp3`, 0.4, synthFallback);
    },

    capsSpend: () => {
      const synthFallback = () => {
        try {
          playNoise(0.01, 0.08, 5000);
          playTone(900, 0.05, 'sine', 0.1);
          setTimeout(() => playTone(700, 0.05, 'sine', 0.06), 30);
        } catch(_) {}
      };
      playFile(`${BASE}/audio/easter-eggs/metal-clink.mp3`, 0.4, synthFallback);
    },

    // ───────────────────── Combat Sounds ─────────────────────

    gunshot: () => {
      const synthFallback = () => {
        try {
          playNoise(0.06, 0.2, 2000);
          playTone(80, 0.08, 'sine', 0.15);
          playNoise(0.03, 0.1, 800);
        } catch(_) {}
      };
      playFile(`${BASE}/audio/sfx/combat/gunshot.mp3`, 0.4, synthFallback);
    },

    laserZap: () => {
      const synthFallback = () => {
        try {
          playFreqSweep(3000, 400, 0.15, 'sawtooth', 0.12);
          playTone(1500, 0.04, 'sine', 0.08);
        } catch(_) {}
      };
      playFile(`${BASE}/audio/sfx/combat/laser-zap.mp3`, 0.4, synthFallback);
    },

    meleeHit: () => {
      const synthFallback = () => {
        try {
          playTone(70, 0.1, 'sine', 0.16);
          playNoise(0.06, 0.14, 1200);
          playNoise(0.03, 0.08, 3000);
        } catch(_) {}
      };
      playFile(`${BASE}/audio/sfx/combat/melee-hit.mp3`, 0.4, synthFallback);
    },

    explosion: () => {
      const synthFallback = () => {
        try {
          playTone(40, 0.3, 'sine', 0.2);
          playNoise(0.15, 0.18, 600);
          playNoise(0.08, 0.12, 1500);
          setTimeout(() => playFreqSweep(80, 30, 0.3, 'sine', 0.1), 100);
        } catch(_) {}
      };
      playFile(`${BASE}/audio/sfx/combat/explosion.mp3`, 0.4, synthFallback);
    },

    healChime: () => {
      try {
        playTone(440, 0.12, 'triangle', 0.1);
        setTimeout(() => playTone(550, 0.12, 'triangle', 0.1), 100);
        setTimeout(() => playTone(660, 0.15, 'triangle', 0.12), 200);
      } catch(_) {}
    },

    stealthShimmer: () => {
      const synthFallback = () => { try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 800;
        lfo.type = 'sine';
        lfo.frequency.value = 12;
        lfoGain.gain.value = 200;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        gain.gain.setValueAtTime(Math.max(0.001, 0.06 * getVol()), t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); lfo.start(t);
        osc.stop(t + 0.4); lfo.stop(t + 0.4);
        osc.onended = () => { try { osc.disconnect(); lfo.disconnect(); lfoGain.disconnect(); gain.disconnect(); } catch(_){} };
      } catch(_) {} };
      playFile(`${BASE}/audio/sfx/combat/ray-gun.mp3`, 0.3, synthFallback);
    },

    missWhiff: () => {
      const synthFallback = () => {
        try {
          playNoiseSweep(0.15, 0.1, 4000, 800, 0.6);
        } catch(_) {}
      };
      playFile(`${BASE}/audio/sfx/combat/sword-swing.mp3`, 0.35, synthFallback);
    },

    criticalHit: () => {
      try {
        // Sub-bass thump
        playTone(35, 0.2, 'sine', 0.2);
        // Standard crit layers
        setTimeout(() => {
          playNoise(0.05, 0.14, 2400);
          playTone(180, 0.05, 'sine', 0.10);
          playTone(360, 0.04, 'triangle', 0.06);
        }, 50);
        // Slow-mo ring
        setTimeout(() => playTone(500, 0.15, 'sine', 0.05), 120);
      } catch(_) {}
    },

    killConfirm: () => {
      try {
        // Death thud
        playTone(100, 0.15, 'sine', 0.12);
        playNoise(0.04, 0.06, 600);
        // XP chime over it
        setTimeout(() => playTone(600, 0.08, 'triangle', 0.1), 80);
        setTimeout(() => playTone(800, 0.1, 'triangle', 0.12), 140);
      } catch(_) {}
    },

    abilityBuff: () => {
      const synthFallback = () => {
        try {
          const ctx = getAudioContext();
          if (!ctx) return;
          const t = ctx.currentTime;
          const osc = ctx.createOscillator();
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = 300;
          lfo.type = 'sine';
          lfo.frequency.value = 5;
          lfoGain.gain.value = 15;
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          gain.gain.setValueAtTime(Math.max(0.001, 0.1 * getVol()), t);
          gain.gain.setValueAtTime(Math.max(0.001, 0.1 * getVol()), t + 0.2);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(t); lfo.start(t);
          osc.stop(t + 0.35); lfo.stop(t + 0.35);
          osc.onended = () => { try { osc.disconnect(); lfo.disconnect(); lfoGain.disconnect(); gain.disconnect(); } catch(_){} };
        } catch(_) {}
      };
      playFile(`${BASE}/audio/sfx/combat/power-up.mp3`, 0.4, synthFallback);
    },

    abilityAoe: () => {
      try {
        playNoise(0.08, 0.18, 1500);
        playFreqSweep(300, 60, 0.2, 'sine', 0.15);
      } catch(_) {}
    },

    abilityHeal: () => {
      try {
        // Inject hiss
        playNoise(0.04, 0.06, 5000);
        // Stimpak chime
        setTimeout(() => playTone(500, 0.1, 'triangle', 0.1), 60);
        setTimeout(() => playTone(630, 0.1, 'triangle', 0.1), 140);
        setTimeout(() => playTone(750, 0.12, 'triangle', 0.12), 220);
      } catch(_) {}
    },

    abilityDebuff: () => {
      try {
        // Sizzle noise
        playNoise(0.15, 0.1, 4000);
        // Geiger clicks
        for (let i = 0; i < 4; i++) {
          setTimeout(() => playNoise(0.003, 0.06, 7000), i * 40);
        }
      } catch(_) {}
    },

    // ─────────────── Lucky 38 Casino Sounds ───────────────

    elevatorHum: () => {
      const synthFallback = () => {
        try {
          const ctx = getAudioContext();
          if (!ctx) return;
          const t = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(50, t);
          osc.frequency.linearRampToValueAtTime(120, t + 2);
          gain.gain.setValueAtTime(Math.max(0.001, 0.08 * getVol()), t);
          gain.gain.setValueAtTime(Math.max(0.001, 0.08 * getVol()), t + 1.5);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 2);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(t); osc.stop(t + 2);
          // Rumble layer
          playNoiseSweep(2, 0.04, 100, 200, 0.3);
          osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(_){} };
        } catch(_) {}
      };
      playFile(`${BASE}/audio/sfx/lucky38/elevator-hum.mp3`, 0.4, synthFallback);
    },

    elevatorDing: () => {
      const synthFallback = () => {
        try {
          playTone(1200, 0.3, 'sine', 0.15);
          playTone(2400, 0.2, 'sine', 0.05);
        } catch(_) {}
      };
      playFile(`${BASE}/audio/sfx/lucky38/elevator-ding.mp3`, 0.4, synthFallback);
    },

    doorsOpen: () => {
      try {
        playNoiseSweep(0.5, 0.1, 800, 3000, 0.5);
      } catch(_) {}
    },

    neonBuzz: () => {
      const synthFallback = () => {
        try {
          playTone(120, 0.12, 'sawtooth', 0.08);
        } catch(_) {}
      };
      playFile(`${BASE}/audio/sfx/lucky38/neon-buzz.mp3`, 0.35, synthFallback);
    },

    leverPull: () => {
      try {
        playNoise(0.04, 0.15, 2000);
        setTimeout(() => playTone(60, 0.12, 'sine', 0.12), 40);
      } catch(_) {}
    },

    wheelSpin: () => {
      try {
        playNoiseSweep(0.2, 0.1, 1500, 2500, 0.5);
      } catch(_) {}
    },

    wheelTick: () => {
      try { playNoise(0.005, 0.08, 6000); } catch(_) {}
    },

    tensionBeat: () => {
      try {
        playTone(60, 0.15, 'sine', 0.15);
      } catch(_) {}
    },

    nearMissSting: () => {
      try {
        // Minor second — dissonant
        playTone(220, 0.5, 'sawtooth', 0.1);
        playTone(233, 0.5, 'sawtooth', 0.1);
      } catch(_) {}
    },

    winCommon: () => {
      try {
        playTone(600, 0.12, 'triangle', 0.12);
        setTimeout(() => playTone(800, 0.15, 'triangle', 0.14), 100);
      } catch(_) {}
    },

    winUncommon: () => {
      try {
        playRichTone(500, 0.12, 'square', 0.1);
        setTimeout(() => playRichTone(630, 0.12, 'square', 0.12), 120);
        setTimeout(() => playRichTone(800, 0.18, 'square', 0.14), 250);
      } catch(_) {}
    },

    winJackpot: () => {
      const synthFallback = () => {
        try {
          // Rapid ascending cascade
          for (let i = 0; i < 8; i++) {
            setTimeout(() => playTone(400 + i * 100, 0.08, 'triangle', 0.1), i * 80);
          }
          // Noise shower
          setTimeout(() => {
            for (let i = 0; i < 6; i++) {
              setTimeout(() => playNoise(0.02, 0.04, 4000 + Math.random() * 2000), i * 60);
            }
          }, 500);
          // Triumphant chord
          setTimeout(() => {
            playRichTone(523, 0.4, 'square', 0.15);
            playTone(659, 0.35, 'triangle', 0.1);
            playTone(784, 0.35, 'triangle', 0.08);
            playTone(1046, 0.3, 'sine', 0.05);
          }, 1000);
        } catch(_) {}
      };
      playFile(`${BASE}/audio/sfx/lucky38/slot-machine.mp3`, 0.45, synthFallback);
    },

    bustPowerdown: () => {
      try {
        playFreqSweep(200, 40, 1.0, 'sine', 0.12);
      } catch(_) {}
    },

    bustRecovery: () => {
      try {
        playTone(120, 0.06, 'sawtooth', 0.08);
        setTimeout(() => playTone(120, 0.06, 'sawtooth', 0.08), 120);
        setTimeout(() => playTone(120, 0.06, 'sawtooth', 0.08), 240);
      } catch(_) {}
    },

    claimClick: () => {
      try {
        playNoise(0.01, 0.12, 5000);
        playTone(400, 0.08, 'sine', 0.1);
      } catch(_) {}
    },

    rewardFlyaway: () => {
      try {
        playNoiseSweep(0.25, 0.08, 1000, 4000, 0.6);
        playFreqSweep(300, 900, 0.25, 'sine', 0.06);
      } catch(_) {}
    },

    // ──────────────── Round Transition ────────────────

    prepStart: () => {
      try {
        playNoise(0.1, 0.1, 3000);
        // Warble
        const ctx = getAudioContext();
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 600;
        lfo.type = 'sine';
        lfo.frequency.value = 20;
        lfoGain.gain.value = 200;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        gain.gain.setValueAtTime(Math.max(0.001, 0.08 * getVol()), t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); lfo.start(t);
        osc.stop(t + 0.3); lfo.stop(t + 0.3);
        osc.onended = () => { try { osc.disconnect(); lfo.disconnect(); lfoGain.disconnect(); gain.disconnect(); } catch(_){} };
      } catch(_) {}
    },

    timerTick: () => {
      try {
        playNoise(0.008, 0.06, 4000);
        playTone(800, 0.015, 'sine', 0.05);
      } catch(_) {}
    },

    timerUrgent: () => {
      try {
        playNoise(0.01, 0.08, 5000);
        playTone(1000, 0.02, 'sine', 0.08);
      } catch(_) {}
    },

    combatStart: () => {
      try {
        // Electronic sweep
        playFreqSweep(200, 1000, 0.2, 'sawtooth', 0.1);
        // Targeting beeps
        setTimeout(() => playTone(1200, 0.04, 'square', 0.08), 200);
        setTimeout(() => playTone(1200, 0.04, 'square', 0.08), 280);
        setTimeout(() => playTone(1600, 0.06, 'square', 0.1), 360);
      } catch(_) {}
    },

    bossApproach: () => {
      const synthFallback = () => {
        try {
          // Alternating klaxon tones
          playTone(440, 0.2, 'sawtooth', 0.14);
          setTimeout(() => playTone(880, 0.2, 'sawtooth', 0.14), 250);
          setTimeout(() => playTone(440, 0.2, 'sawtooth', 0.14), 500);
          setTimeout(() => playTone(880, 0.2, 'sawtooth', 0.14), 750);
        } catch(_) {}
      };
      playFile(`${BASE}/audio/sfx/combat/warning-siren.mp3`, 0.4, synthFallback);
    },

    bossEntrance: () => {
      try {
        // Deep horn sweep
        playFreqSweep(60, 200, 0.6, 'sawtooth', 0.16);
        playNoiseSweep(0.8, 0.08, 200, 80, 0.4);
        // Dramatic hit
        setTimeout(() => {
          playTone(40, 0.3, 'sine', 0.2);
          playNoise(0.1, 0.15, 600);
        }, 500);
      } catch(_) {}
    },

    // ──────────── Easter Egg / Flavor ────────────

    geigerTick: () => {
      const synthFallback = () => {
        try { playNoise(0.003, 0.06, 7000); } catch(_) {}
      };
      playFile(`${BASE}/audio/easter-eggs/geiger-counter.mp3`, 0.35, synthFallback);
    },

    vaultDoor: () => {
      const synthFallback = () => {
        try {
          playNoiseSweep(1.0, 0.1, 200, 100, 0.3);
          playFreqSweep(50, 30, 1.0, 'sine', 0.08);
        } catch(_) {}
      };
      playFile(`${BASE}/audio/easter-eggs/vault-door.mp3`, 0.45, synthFallback);
    },

    holotapeInsert: () => {
      try {
        // Click
        playNoise(0.01, 0.1, 4000);
        // Data whir
        setTimeout(() => {
          const ctx = getAudioContext();
          if (!ctx) return;
          const t = ctx.currentTime;
          const osc = ctx.createOscillator();
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = 2000;
          lfo.type = 'sine';
          lfo.frequency.value = 30;
          lfoGain.gain.value = 800;
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          gain.gain.setValueAtTime(Math.max(0.001, 0.05 * getVol()), t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(t); lfo.start(t);
          osc.stop(t + 0.3); lfo.stop(t + 0.3);
          osc.onended = () => { try { osc.disconnect(); lfo.disconnect(); lfoGain.disconnect(); gain.disconnect(); } catch(_){} };
        }, 50);
      } catch(_) {}
    },

    bobbleheadWobble: () => {
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 400;
        lfo.type = 'sine';
        lfo.frequency.value = 15;
        lfoGain.gain.value = 300;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        gain.gain.setValueAtTime(Math.max(0.001, 0.1 * getVol()), t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); lfo.start(t);
        osc.stop(t + 0.3); lfo.stop(t + 0.3);
        osc.onended = () => { try { osc.disconnect(); lfo.disconnect(); lfoGain.disconnect(); gain.disconnect(); } catch(_){} };
      } catch(_) {}
    },

    // ──────────────── Music Control ────────────────

    startCasinoMusic: () => {
      try {
        if (!casinoMusic) {
          casinoMusic = new Audio(`${BASE}/audio/music/casino-jazz.mp3`);
          casinoMusic.loop = true;
        }
        casinoMusic.volume = Math.max(0.01, 0.25 * getVol());
        casinoMusic.play().catch(() => {});
      } catch(_) {}
    },

    stopCasinoMusic: () => {
      try {
        if (casinoMusic) {
          casinoMusic.pause();
          if (casinoMusic._interval) clearInterval(casinoMusic._interval);
          casinoMusic.currentTime = 0;
          casinoMusic = null;
        }
      } catch(_) {}
    },

    startBossMusic: () => {
      try {
        if (!bossMusic) {
          bossMusic = new Audio(`${BASE}/audio/music/boss-battle.mp3`);
          bossMusic.loop = true;
        }
        bossMusic.volume = Math.max(0.01, 0.3 * getVol());
        bossMusic.play().catch(() => {});
      } catch(_) {}
    },

    stopBossMusic: () => {
      try {
        if (bossMusic) {
          bossMusic.pause();
          bossMusic.currentTime = 0;
          bossMusic = null;
        }
      } catch(_) {}
    },
  };
};

const baseSound = createSound();

/**
 * FO4 Audio Layer — wraps each sound method to try local FO4 files first.
 * Files served from ~/.wasteland-tactics-audio/ via Vite dev server at /fo4-audio/
 * Falls back to existing audio (downloaded MP3s or Web Audio synthesis) if FO4 files missing.
 */
const FO4_MAP = {
  // { file, maxMs } — maxMs fades out playback after that duration
  click:        { file: 'ui/pipboy-click.wav' },
  hover:        { file: 'ui/pipboy-dial.wav' },
  tabSwitch:    { file: 'ui/pipboy-tab.wav' },
  toggleSwitch: { file: 'ui/pipboy-select.wav' },
  sliderTick:   { file: 'ui/pipboy-dial.wav' },
  deny:         { file: 'ui/pipboy-deselect.wav' },
  experienceUp: { file: 'ui/experience-up.wav' },
  levelUp:      { file: 'music/level-up.wav', maxMs: 2000 },
  capsEarn:     { file: 'ui/caps-earn.wav' },
  capsSpend:    { file: 'ui/caps-spend.wav' },
  combatStart:  { file: 'ui/vats-enter.wav' },
  criticalHit:  { file: 'ui/vats-critical.wav', maxMs: 1500 },
  gunshot:      { file: 'combat/pistol-10mm.wav' },
  laserZap:     { file: 'combat/laser-pistol.wav' },
  meleeHit:     { file: 'combat/sledgehammer.wav' },
  explosion:    { file: 'combat/nuke-explosion.wav', maxMs: 2000 },
  hit:          { file: 'combat/bullet-impact.wav' },
  crit:         { file: 'combat/bullet-impact2.wav' },
  death:        { file: 'combat/explosive-impact.wav' },
  killConfirm:  { file: 'ui/discover-location.wav', maxMs: 1500 },
  geigerTick:   { file: 'fx/geiger-counter.wav', maxMs: 1000 },
  vaultDoor:    { file: 'fx/vault-door-open.wav' },
  abilityAoe:     { file: 'combat/fat-man-fire.wav', maxMs: 1500 },
  abilityBuff:    { file: 'combat/gauss-impact.wav' },
  abilityDebuff:  { file: 'combat/plasma-explosion.wav', maxMs: 1000 },
  abilityHeal:    { file: 'combat/laser-impact.wav' },
  stealthShimmer: { file: 'combat/laser-projectile.wav' },
  missWhiff:      { file: 'combat/deathclaw-melee.wav' },
  victory:        { file: 'music/level-up.wav', maxMs: 1800 },
  defeat:         { file: 'ui/vats-exit.wav' },
  elevatorDing:   { file: 'ui/caps-earn2.wav' },
  neonBuzz:       { file: 'fx/radiation-emitter.wav', maxMs: 500 },
  bossApproach:   { file: 'combat/nuke-explosion.wav', maxMs: 1500 },
  bossEntrance:   { file: 'combat/fat-man-fire.wav', maxMs: 2000 },
};

// Track which FO4 files exist (tested once per file)
const fo4Status = {}; // path -> true/false/null(untested)
const fo4AudioPool = {}; // path -> Audio[]

function playFO4(path, volume, fallback, maxMs) {
  const url = `/fo4-audio/${path}`;

  if (fo4Status[path] === false) {
    if (fallback) fallback();
    return;
  }

  try {
    if (!fo4AudioPool[path]) fo4AudioPool[path] = [];
    let audio = fo4AudioPool[path].find(a => a.paused || a.ended);
    if (!audio && fo4AudioPool[path].length < 3) {
      audio = new Audio(url);
      audio.addEventListener('error', () => { fo4Status[path] = false; });
      fo4AudioPool[path].push(audio);
    } else if (!audio) {
      audio = fo4AudioPool[path][0];
      audio.currentTime = 0;
    }

    if (audio) {
      const vol = Math.max(0.01, volume * WT_SETTINGS.volume);
      audio.volume = vol;
      const p = audio.play();
      if (p) p.catch(() => {
        fo4Status[path] = false;
        if (fallback) fallback();
      });
      if (fo4Status[path] === undefined) fo4Status[path] = true;
      // Cut playback short if maxMs is set — fade out then stop
      if (maxMs && maxMs > 0) {
        const fadeAudio = audio; // capture reference to this specific playback
        setTimeout(() => {
          try {
            if (fadeAudio.paused) return; // already stopped or reused
            const fadeSteps = 10;
            const fadeInterval = 100;
            let step = 0;
            const fadeOut = setInterval(() => {
              if (fadeAudio.paused) { clearInterval(fadeOut); return; }
              step++;
              fadeAudio.volume = Math.max(0.001, vol * (1 - step / fadeSteps));
              if (step >= fadeSteps) {
                clearInterval(fadeOut);
                fadeAudio.pause();
                fadeAudio.currentTime = 0;
                fadeAudio.volume = vol;
              }
            }, fadeInterval);
          } catch(_) {}
        }, maxMs);
      }
    }
  } catch (_) {
    fo4Status[path] = false;
    if (fallback) fallback();
  }
}

// Build wrapped sound object — tries FO4 file first, falls back to base
const sound = {};
for (const key of Object.keys(baseSound)) {
  if (FO4_MAP[key]) {
    const cfg = FO4_MAP[key];
    const path = cfg.file;
    const maxMs = cfg.maxMs || 0;
    const baseFn = baseSound[key];
    sound[key] = () => {
      playFO4(path, 0.5, baseFn, maxMs);
    };
  } else {
    sound[key] = baseSound[key];
  }
}

export { sound };
