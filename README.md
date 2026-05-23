<div align="center">

<img src="assets/banner.svg" alt="Wasteland Tactics" width="100%"/>

<br/>

[![Play Now](https://img.shields.io/badge/PLAY_NOW-0d0d08?style=for-the-badge&logo=githubpages&logoColor=00ff00&labelColor=0d0d08&color=00ff00)](https://psychebear.github.io/Wasteland_Tactics/)
[![Source](https://img.shields.io/badge/SOURCE-0d0d08?style=for-the-badge&logo=github&logoColor=ffb000&labelColor=0d0d08&color=ffb000)](https://github.com/PsycheBear/Wasteland_Tactics)

![React](https://img.shields.io/badge/React-18-00ff00?style=flat-square&labelColor=0d0d08&logo=react&logoColor=00ff00)
![Vite](https://img.shields.io/badge/Vite-6-ffb000?style=flat-square&labelColor=0d0d08&logo=vite&logoColor=ffb000)
![Tests](https://img.shields.io/badge/TESTS-212_passing-00ff00?style=flat-square&labelColor=0d0d08)
![Status](https://img.shields.io/badge/STATUS-OPERATIONAL-00ff00?style=flat-square&labelColor=0d0d08)

</div>

<img src="assets/divider.svg" alt="" width="100%"/>

```
> INCOMING TRANSMISSION FROM VAULT-OS v2.77 ...
> DECRYPTING ............................. [OK]
> WELCOME, OVERSEER.
```

Draft a squad of mutants, raiders, vault dwellers, and rogue robots. Manage your caps, slot together salvaged gear, and survive escalating waves of horrors crawling out of the wastes. Every fight runs on autopilot — your edge lives in the **draft, the synergies, and the build**.

<img src="assets/divider.svg" alt="" width="100%"/>

## <img src="assets/section.svg" alt="" width="20" align="center"/> PLAY

The only way to play is the live GitHub Pages build:

### **<https://psychebear.github.io/Wasteland_Tactics/>**

Auto-deployed on every push to `Main` via [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml). No install, no setup — open the link and you're in. Saves are kept in your browser's localStorage.

<img src="assets/divider.svg" alt="" width="100%"/>

## <img src="assets/section.svg" alt="" width="20" align="center"/> FEATURES

| | |
|---|---|
| **Unit Drafting** | 22 units across 8 synergy traits — pull from a shared shop and roll for upgrades |
| **Synergy Engine** | Stack matching traits to unlock tiered buffs that warp the whole fight |
| **Item Crafting** | 7 components combine into 25 completed items — equip up to 3 per unit |
| **Augments** | 20 strategy-defining mutations offered at key rounds |
| **Boss Encounters** | 5 boss rounds with unique mechanics — culminating in Mothman's darkness shroud at round 35 |
| **Difficulty Modes** | Easy / Normal / Hard / Survival — picks at run start, persists across reloads |
| **Smart Ghost AI** | PvP ghost squads use a synergy-aware scorer instead of random picks |
| **Auto-Combat** | Pip-Boy-styled animations, floating damage, status effects, ability flashes |
| **Lore Tooltips** | Hold **Shift** (or long-press on touch) over a unit to read its canon Fallout lore |
| **Profile Panel** | **Ctrl+Shift+P** — lifetime stats, error log, build export/import, replay viewer |
| **Replay System** | Last 5 fights persist; step through with prev/next or watch at 0.5×/1×/2× speed |
| **Persistent Saves** | Local-storage checkpoints — close the tab and pick up where you left off |
| **Mobile Ready** | Responsive 768px / 480px breakpoints; CRT scanlines disable on small screens |
| **Accessibility** | Pip-Boy-green `:focus-visible` rings, `prefers-reduced-motion` respected |

<img src="assets/divider.svg" alt="" width="100%"/>

## <img src="assets/section.svg" alt="" width="20" align="center"/> CONTROLS

| Input | Action |
|---|---|
| `Click` / `Tap` | Buy units, equip items, drag to board |
| `Shift` (hold) | Expand unit tooltip with lore blurb |
| `Long-press` (touch) | Same as Shift — expand tooltip |
| `Ctrl+Shift+P` | Open Profile Panel |
| `Tab` | Cycle focus across UI (Pip-Boy-green focus ring) |
| `Enter` / `Space` | Activate focused element |

<img src="assets/divider.svg" alt="" width="100%"/>

## <img src="assets/section.svg" alt="" width="20" align="center"/> TECH STACK

```
┌──────────────────────────────────────────────┐
│  Frontend ............... React 18           │
│  Bundler ................ Vite 6             │
│  Styles ................. CSS3 + Pip-Boy CRT │
│  Fonts .................. VT323, Share Tech  │
│  State .................. React hooks        │
│  Persistence ............ localStorage       │
│  Tests .................. Vitest + jsdom     │
│  Deploy ................. GitHub Actions     │
└──────────────────────────────────────────────┘
```

<img src="assets/divider.svg" alt="" width="100%"/>

## <img src="assets/section.svg" alt="" width="20" align="center"/> PROJECT LAYOUT

```
src/
├── main.jsx              # entry + ErrorBoundary + global error listeners
├── styles.css            # Pip-Boy theme, mobile breakpoints, focus rings
├── components/
│   ├── Game.jsx          # root coordinator
│   ├── UiComponents.jsx  # shared primitives (cards, tooltips, portraits)
│   ├── AugmentPicker.jsx
│   ├── BossIntro.jsx     # multi-frame crossfade for boss intros
│   ├── DifficultySelector.jsx
│   ├── ProfilePanel.jsx  # stats + replay + export/import
│   ├── ReplayViewer.jsx
│   └── Lucky38Carousel.jsx
├── hooks/
│   ├── useGameState.js   # reducer scaffold for future migration
│   └── useSave.js        # localStorage + replay persistence
├── lib/
│   ├── logger.js         # ring-buffer error log
│   └── buildCodec.js     # base64 build export/import
├── data/
│   ├── units.js          # 22 unit defs + lore + portrait hooks
│   ├── traits.js         # 8 synergy traits
│   ├── items.js          # 7 components + 25 completed items
│   ├── augments.js       # 20 round-reward augments
│   ├── bosses.js         # 5 boss encounters (including Mothman)
│   ├── difficulty.js     # 4 difficulty modes
│   ├── lore.js           # canon Fallout lore blurbs
│   └── constants.js
├── systems/
│   ├── combat.js         # auto-combat, ghost AI, shroud mechanic
│   └── audio.js          # SFX + music
└── test/
    ├── combat.test.js    # 39 tests on synergy, status, AI scorer
    ├── data.test.js      # 173 integrity tests across all data files
    └── setup.js
```

<img src="assets/divider.svg" alt="" width="100%"/>

## <img src="assets/section.svg" alt="" width="20" align="center"/> DEVELOPER NOTES

Want to hack on it? The play target is GitHub Pages, but the source is here to read, fork, or PR against.

```bash
git clone https://github.com/PsycheBear/Wasteland_Tactics.git
cd Wasteland_Tactics
npm install
npm run dev        # local dev server (HMR) — not the way to "play"
npm run test:run   # 212 tests
npm run build      # production bundle to dist/
```

Local dev needs Node ≥ 20.

<img src="assets/divider.svg" alt="" width="100%"/>

## <img src="assets/section.svg" alt="" width="20" align="center"/> CREDITS

Built by **[PsycheBear](https://github.com/PsycheBear)** with contributions from **[stachenuggets](https://github.com/stachenuggets)**.

```
> END TRANSMISSION
> WAR. WAR NEVER CHANGES.
```
