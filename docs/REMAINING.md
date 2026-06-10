# Remaining work

Status after final pass (May 2026). The core loop is playable; CI is green for build and tests.

## Automated checks

| Check | Status |
|-------|--------|
| `npm run lint` | Pass (0 errors; optional hook-deps warnings in a few components) |
| `npm run test` | Pass (19 tests) |
| `npm run build` | Pass → `dist/` |

## User-actionable only

| Item | Notes |
|------|--------|
| **Stripe payments** | Meta shop / cosmetics monetization — not wired; needs Stripe account, keys, and checkout UI |
| **Optional custom art** | Drop PNGs in `public/images/units/` per `docs/IMAGE_DROP_FOLDER.md`, or generate via `docs/GROK_IMAGE_PROMPTS.md`; game defaults to SVG icons and letter placeholders |
| **Discord / social URLs** | Footer links in `Game.jsx` still point at `https://discord.com` placeholders — replace with real invite URLs when ready |
| **Regenerate icon PNGs (optional)** | `npm run generate:assets` if you change `scripts/generate-icons.js` source art |

## Shipped in codebase (no action required)

- Item components and completed items use `public/images/icons/*.svg` via `iconImg` in `src/data/items.js`
- `GameIcon.jsx` renders SVG/PNG or a letter badge (no emoji fallbacks)
- Dev server: `npm run dev` → Vite (typically `http://localhost:5173`) — see README Quick Start
- GitHub Pages deploy on push to `Main` (`.github/workflows/deploy-pages.yml`)
