# Handoff: Sipelle — cocktail discovery app

## Overview
Sipelle is a mobile app for discovering cocktails: users scan a bar menu and get illustrated drink recommendations with prices and ratings. This package contains everything needed to implement the three designed screens — Splash, Home, and Results — in a real app codebase.

## About the Design Files
The files in this bundle are **design references created in HTML** — interactive prototypes showing intended look and behavior, not production code to copy directly. Your task is to **recreate these designs in your codebase's environment** (React Native, Flutter, SwiftUI, etc.) using its established patterns. If no app codebase exists yet, pick the framework that fits your target platforms and implement the designs there.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and shadows below are exact values extracted from the original Stitch mockups. Recreate the UI pixel-perfectly. All artwork is provided as PNG crops in `design-system/assets/`.

## Package Contents
- `design-system/` — tokens (CSS custom properties), 16 PNG assets, reference React components, spec sheet, readme, SKILL.md
- `reference/Sipelle App.dc.html` — the interactive HTML prototype source (templating is proprietary; read it for structure/values, don't run it standalone)
- `original-screens/` — the three original Stitch mockups (768×1376) for visual ground truth

> Tip: `design-system/SKILL.md` makes this folder usable as a Claude Code skill — drop `design-system/` into `.claude/skills/sipelle-design/` in your workspace and Claude Code can design against the brand automatically.

## Screens

### 1. Splash
- **Purpose**: launch screen; any tap advances to Home.
- **Layout**: full-bleed image `assets/splash-full.png` (or rebuild: flat pink `#FBE7E6` background, watercolor flourishes in top-left and bottom-right corners with gold `#D8B56A` line accents, centered spritz-glass illustration, serif wordmark "sipelle" below it).
- **Type**: wordmark — Playfair Display 600, lowercase, ~64px @2x.

### 2. Home
- **Purpose**: greeting + category browse + primary "Scan Menu" action.
- **Background**: vertical wash gradient — `#E4F5FC` (powder blue, top) → `#F9E4E6` (blush, 34%) → `#FBE9D9` (peach, 62%) → `#FFFFFF` (bottom).
- **Header row** (screen gutter 20px):
  - Left column: "Sipelle" (Caveat 600, 34px), "Hello John!" (Caveat 600, 44px, line-height 1.05), subtitle "What are you in the mood for today?" (system sans 13px, `#4A4245`, max-width ~150px).
  - Right: `assets/hero-cocktail.png` (~210×233, bleeds slightly off the right edge).
- **Category row**: 3 chips (`category-citrus.png`, `category-beer.png`, `category-exotic.png`), 92px circles, shadow `0 2px 8px rgba(90,70,50,0.10)`, labels beneath in Caveat 600 22px. Tap → Results.
- **Scan Menu**: `assets/scan-menu-blob.png`, ~190px, centered. Primary action → Results.
- **Tab bar**: 72px + safe area, white, 1px top border `rgba(0,0,0,0.05)`. Icons: Lucide `house` / `search` / `circle-user-round`, 26px. Active tint rose `#E9A6B3`; inactive 40% opacity ink.

### 3. Results ("Union Square")
- **Purpose**: drink recommendations for a scanned venue.
- **Background**: cream `#F7EDE0`.
- **Header**: back arrow (44px hit target) → Home; centered title "Union Square" (Playfair Display 600, 30px).
- **Drink cards** (vertical stack, 20px gap):
  - Container: `#F3E7D8`, radius 28px, padding 16px, shadow `0 10px 24px rgba(90,70,50,0.14)`.
  - Thumbnail: 104×109, white tile, radius 26px, shadow `0 2px 8px rgba(90,70,50,0.10)` — `drink-aperol-spritz.png`, `drink-dirty-martini.png`, `drink-mojito.png`.
  - Name: Playfair Display 600, 21px. Price pill: `#F7EDDD`, radius 16px, padding 6×11, 700 16px, shadow `0 4px 10px rgba(90,70,50,0.18)`.
  - Stars: ★ glyphs, 16px, 2px letter-spacing. Description: 13.5px, `#4A4245`.
  - Content: Aperol Spritz $14 ★★★★★ "Refreshing with prosecco and orange"; Dirty Martini $16 ★★★★☆ "Classic gin with an olive twist"; Mojito $13 ★★★★☆ "Cool mint, lime and white rum".

## Interactions & Behavior
- Splash tap → Home. Category chip / Scan Menu tap → Results. Back arrow → Home.
- Drink card tap → transient toast ("<name> — added to favourites"), dark pill (`#2B2528` on cream text), auto-dismiss ~1.6s. Placeholder behavior — replace with your real favourites flow.
- Press state everywhere: scale 0.97, 120ms, `cubic-bezier(0.25, 0.1, 0.25, 1)`. No color shifts on press.
- Entrances: fade + 14px rise. No other animation.

## State Management
Prototype state is minimal: `screen: 'splash' | 'home' | 'results'` and a transient `toast: string`. Real app additionally needs: scanned-venue data (name + drink list), favourites, and auth/user name for the greeting.

## Design Tokens
Full set in `design-system/tokens/*.css` (colors, typography, spacing, effects) — treat those files as the source of truth. Highlights:
- **Fonts**: no binaries were provided; nearest Google Fonts matches are Playfair Display (serif display) and Caveat (handwritten). Body text is system sans (SF Pro / Roboto).
- **Radii**: card 28, tile 26, pill 16, chips full. **Min hit target**: 44px.
- **Shadows**: all soft, warm-tinted `rgba(90,70,50,…)` — no hard borders anywhere.

## Assets
16 PNGs in `design-system/assets/`, all cropped from the original Stitch mockups (2x scale). Note: the watercolor illustrations are raster crops that include a slice of painted background — they sit correctly on the matching washes but are not transparent cut-outs. Tab icons are Lucide (open source, use the `lucide-react-native`/platform package rather than CDN).

## Files
- `reference/Sipelle App.dc.html` — prototype markup + logic (all styles inline; exact values)
- `design-system/spec-sheet.html` — open in a browser to see tokens and components rendered
- `design-system/readme.md` — brand/visual foundations write-up
- `original-screens/*.png` — original mockups
- `assets/*.png` — assets
