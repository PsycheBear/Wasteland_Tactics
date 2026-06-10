# Unit image drop folder (optional)

Custom unit portraits are **optional**. The game ships with embedded art, gradients, and letter placeholders — you can play without adding any files here.

## Location

```
public/images/units/
```

## File naming

| Use | Filename pattern | Example |
|-----|------------------|---------|
| 1★ board / combat | `{unit-id}-1.png` | `preston-1.png` |
| 2★ | `{unit-id}-2.png` | `preston-2.png` |
| 3★ | `{unit-id}-3.png` | `preston-3.png` |
| Shop slot | `{unit-id}-shop.png` | `preston-shop.png` |

`{unit-id}` must match the key in `src/data/units.js` (e.g. `dogmeat`, `sturges`, `nick`).

## Resolution

- **Square PNG** recommended (e.g. 256×256 or 512×512).
- Transparent background works best on the board.

## Fallback order

1. `public/images/units/{id}-{stars}.png` (or `-shop.png`)
2. Embedded art in `src/data/images.js` (if present)
3. Letter placeholder (`UnitPlaceholder`)

Mapping lives in `src/data/unitImagePaths.js`.

## User-provided zips (optional)

You may unpack per-unit asset packs (e.g. `preston_garvey_assets.zip`) into `public/images/units/` using the naming table above. Zips are **not required** — drop individual PNGs or skip custom art entirely. For AI-generated batches, see `docs/GROK_IMAGE_PROMPTS.md`.
