# Sipelle Design System

Sipelle is a cocktail-discovery phone app: scan a bar's menu, browse drinks by category, and see rated results. The visual identity is **soft watercolor** — painted washes, illustrated drinks, no hard edges, no photography.

Source: three Stitch-generated screens (splash, home, results) provided as PNGs. No Figma, codebase, or font files were given, so all tokens are sampled from those images and fonts are nearest Google-Fonts matches.

## Content fundamentals

- Warm, first-name-friendly: "Hello John!" — greetings use the user's name with an exclamation.
- Drink descriptions are one short sentence-case line, no trailing period pressure: "Refreshing with prosecco and orange", "Rum, fresh lime, and mint".
- Labels are single words ("Citrus", "Beer", "Exotic"); actions are two words ("Scan Menu").
- Prices are bare and bold: "$14". Ratings are stars only, no numbers.
- No emoji anywhere. The playfulness comes from the artwork and hand-written type, not from copy.

## Visual foundations

- **Backgrounds**: watercolor washes, never flat white full-screen. Splash is a flat pink (`--wash-splash`) with gold-line flourishes in opposite corners; home mixes blush/mint/powder washes; results is a warm cream (`--wash-cream`) with peach + blue brushstrokes. Ship washes as full-bleed images (see `assets/`), not CSS gradients.
- **Type**: three faces. Serif display (≈ Playfair Display) for the wordmark, screen titles, drink names. Hand-written (≈ Caveat) for greetings, category labels, and the casual home wordmark. System sans for body/descriptions/prices. Two wordmark treatments exist: lowercase serif "sipelle" (splash) and hand-written "Sipelle" (home).
- **Color**: pastel washes + near-black ink (`--ink`). No saturated accents except the muted gold flourish lines and the rose active-tab tint.
- **Cards**: cream (`--surface-card`), 28px radius, soft warm shadow, generous 18px padding. No borders anywhere in the app.
- **Buttons**: there are no conventional buttons — actions are artwork (the scan blob) or bare icons. Press state: scale to 0.97, 120ms ease; no color shift.
- **Imagery**: watercolor illustration only. Drink thumbnails sit on white rounded tiles inside cards. Never use photos or flat vector icons for drinks.
- **Layout**: single column, center-aligned titles, 20px screen gutters, big touch targets (min 44px). Tab bar is plain white, 84px.
- **Animation**: nothing in the source screens implies motion; keep it minimal — soft fades and the press scale.

## Iconography

The source uses thin ink line icons (camera, back arrow, home, search, profile) — a standard 2px-stroke outline style. No icon assets could be extracted from the rasters, so use **Lucide** (matching stroke style): `house`, `search`, `circle-user-round`, `camera`, `arrow-left`. CDN: `https://unpkg.com/lucide-static/icons/<name>.svg`, or the `lucide-react` package in an app. Flagged as a substitution — replace if you have the original icon set.

## Index

- `styles.css` — global entry; imports all tokens.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css`.
- `assets/` — 16 PNGs cropped from the screens: wordmarks, hero + splash illustrations, category chips, drink thumbnails, scan blob, wash/flourish swatches, full splash (`splash-full.png`, use as-is for launch).
- `components/core/` — React primitives, each with `.d.ts` props + `.prompt.md` usage:
  - `ScreenHeader` — back arrow + serif title
  - `CategoryChip` — watercolor circle + hand label
  - `DrinkCard` — thumbnail, name, stars, description, price (composes the next two)
  - `StarRating`, `PricePill`
  - `ScanAction` — watercolor blob primary action
  - `TabBar` — 3-icon bottom nav
- `spec-sheet.html` — static visual spec of tokens + every component state.
- `SKILL.md` — agent instructions for designing with this system.

## Caveats

- Fonts are substitutions (Playfair Display, Caveat) — swap in the real files if the Stitch design used something else.
- All artwork is raster-cropped from the screens; watercolor pieces keep a slice of painted background. For true cut-outs, run background removal.
- No logo file existed beyond the wordmarks; none was invented.
