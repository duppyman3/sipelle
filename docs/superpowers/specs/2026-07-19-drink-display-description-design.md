# Drink Display Description — Design

**Date:** 2026-07-19
**Status:** Approved; implemented (server contract, client types, card rendering). Live on `scan-menu` (v10) since 2026-07-22; the temporary `scan-menu-v2` alias is retired.

## Problem

The results-screen drink cards had no consumer-facing body text, so they rendered
`visualDescription` — a prompt written *for the image model* ("in a coupe glass, pale gold, lemon
twist, on a marble bar…"). That is appearance-and-glassware copy meant to paint a picture, not to
tell a person what the drink is. Cards need real menu prose: the description the restaurant printed
when there is one, and otherwise a short "what this drink typically is" blurb.

The server already extracts the printed description verbatim into `menu_description`, but strips it
off the wire because it feeds the image-cache key (`computeImageKey`). So the text a card wants
exists server-side but never reaches the client, and the only per-drink text on the wire today is
the image prompt.

## Wire contract

`scan-menu` gains a per-drink **`description`** field — the card's display text:

- **Printed description present** → `description` is the printed menu text, verbatim (clamped to
  `MAX_MENU_DESCRIPTION_CHARS`). Identical bytes to what already feeds the cache key.
- **No printed description** → `description` is the model-written `typical_description` (clamped to
  `MAX_TYPICAL_DESCRIPTION_CHARS = 400`), a one-or-two-sentence "typical for this drink" blurb.
- The merge lives in `normalizeDrink` (`_shared/menu.ts`): `menuDescription ?? typicalDescription`.

`menuDescription` **stays off the wire** exactly as before — it is destructured out in
`signMenuScan`'s `({ menuDescription, ...drink })` spread and only ever feeds `computeImageKey`. The
new `description` field rides the wire in its place. `SignedDrink = Omit<ScannedDrink,
'menuDescription'>`, so adding `description` to `ScannedDrink` carries it to the wire automatically;
`signMenuScan` needed zero changes.

`visualDescription` is unchanged and remains the image-generation prompt only. It must **never**
render on a card — that was the bug this fixes.

## Always generate `typical_description`

The schema marks `typical_description` `required` and the prompt asks for it on **every** drink,
including drinks that already have a printed description. That is deliberate:

- **Spurious generation is harmless.** When a printed description exists, `normalizeDrink` picks
  `menuDescription` and the model's `typical_description` is simply discarded. A few wasted output
  tokens, no user-visible effect.
- **Conditional generation risks blank cards.** The alternative — "write `typical_description` only
  when there is no printed description" — couples a creative field to a per-drink branch the model
  has to get right. When it guesses wrong (no printed description, but it skipped the blurb because
  it thought there was one), the card renders nothing. Unconditional generation removes that failure
  mode: there is always a fallback string.
- **The instruction never references printed text.** `typical_description` is described purely as
  "typical ingredients and character, written like a menu blurb." It does not tell the model to read,
  compare against, or transform `menu_description`. That separation is what keeps the extraction of
  `menu_description` — and therefore the cache key — untouched (see below).

## Key-stability constraints

Image-cache keys are `sha256` over the normalized name + printed menu description. A past incident
(the v8 detour, 2026-07-16) showed that adding *examples* to the scan prompt made the model
spell-correct printed text ("Bulliet"→"Bulleit"), which shifted keys and orphaned cached images. So
every change here was made additively and defensively:

- **Byte-identical pre-existing prompt.** The new "Separately, write one or two short sentences…"
  sentence is a pure insertion between two existing sentences. Every other sentence in the
  concatenated `PROMPT` string is unchanged to the byte, including the "Copy the drink's printed
  description verbatim into menu_description…" instruction that governs extraction.
- **No brand-name examples anywhere** — not in the prompt, not in the schema descriptions. The new
  `typical_description` schema description is generic ("like a menu blurb").
- **`computeImageKey` and `signMenuScan` are untouched.** The key is still computed from
  `drink.name` + `menuDescription`, which are extracted by the same unchanged instructions.
- **No `IMAGE_KEY_VERSION` bump.** The `drink-image` prompt and model are unchanged and no key input
  changed, so every already-cached image stays valid.

## `max_tokens: 30000`

`buildScanBody` now sets `max_tokens: 30_000`. Adding a second per-drink text field (a
required, always-generated `typical_description`) plus the reasoning/thinking tokens the models spend
raises worst-case completion size. A truncated completion fails `JSON.parse` in `scan-menu/index.ts`
and 502s (that path currently logs nothing), so the scan needs explicit output headroom.

30000 is sized for the worst case — ~30 drinks (`SCAN_DRINK_LIMIT`) of JSON plus reasoning tokens,
which count toward the completion cap on both the primary (`gpt-5.4-mini`) and fallback
(`gemini-2.5-flash`) models — and sits far below both models' output ceilings, so it never truncates
a legitimate response yet still bounds a runaway one. This is the "add explicit `max_tokens` when the
list grows" follow-up the `SCAN_DRINK_LIMIT` and Scan-item-cap notes flagged; those notes are
reworded to "revisit" it now that it exists.

## Client behavior

`ScannedDrink` (`src/ai/menu-scan.ts`) and `SessionDrink` (`src/data/scan-session.ts`) gain an
optional `description?: string | null`. The existing `...drink` spread in the scan→session mapping
carries it through unchanged.

- Render `description` as the card body text.
- **When `description` is absent** (an older backend that predates this contract), render **no**
  description paragraph and **no** expand chevron — the card simply has no body text.
- **Never** fall back to `visualDescription` for display. An old backend showing nothing is correct;
  showing the image prompt is the bug.

Optional (`?`) on both types is what makes old-app/new-server and new-app/old-server pairs safe: a
missing field is a no-op, never a crash.

**Update 2026-07-22:** the expand/collapse accordion was removed at the user's request — the card is no
longer pressable and there is no chevron. The full `description` renders unclamped (no 3-line collapse)
and the Taste Notes line always renders. The absent-`description` handling and the never-fall-back-to-
`visualDescription` rule above are unchanged. Separately, bare printed prices now display with a `$`
prefix via the `displayPrice` helper in `src/components/scanned-drink-card.tsx` (a value starting with a
digit gets `$`; printed symbols like `$14`/`€9` pass through); the server still extracts the price
verbatim.

## Taste Notes (added 2026-07-19)

`scan-menu` gains a second display-only field, per-drink **`tasteNote`** — one sentence (20–40 words)
on what the drink actually tastes like, shown by the card **only in its expanded state** (until 2026-07-22; now shown unconditionally — see the update note at the end of this section), under a bold
inline **"Taste Notes:"** label ahead of the sentence.

- **Content rule.** The sentence is distilled from the user's mixologist prompt file into a single
  sensory summary: overall sweetness, tartness or bitterness, the most noticeable flavor notes, body,
  alcohol warmth, and finish. It names **only flavors an average person would actually notice** and is
  **never a list of ingredients** — that separation keeps it a taste impression rather than a recipe
  restatement. The prompt sentence and schema description state this in generic terms, with **no
  brand-name examples** (same key-stability rule as everywhere else — see "Key-stability constraints").
- **Always generated.** `taste_note` is `required` in the schema and asked for on **every** drink, for
  the same reason as `typical_description`: unconditional generation removes the blank-field failure
  mode, and the wasted tokens when it is not shown are harmless. `normalizeDrink` clamps it to
  `MAX_TASTE_NOTE_CHARS = 300`; being display-only, it is recomputed each scan and never cached.
- **Supersedes the truncation-aware chevron.** The display-description design left the expand chevron's
  value contingent on `description` overflowing three collapsed lines (see "Out of scope"). With
  `tasteNote`, **every** card now has expanded-only content, so the chevron is always meaningful and the
  truncation-aware-hide idea is dropped rather than deferred.
- **Deliberately not built.** The same mixologist prompt file also specifies a longer 75–150-word
  detailed description and a set of 3–8 short flavor tags per drink. Neither is built: the card's
  body is the existing `description`, and the card shows only the one-sentence
  `tasteNote`. Adding the long description or tag chips is a future call, not part of this change.

**Update 2026-07-22:** the accordion was removed at the user's request — cards no longer expand or
collapse, there is no chevron, and the card is not pressable. The `tasteNote` line and the full
`description` now render on **every** card unconditionally. The server contract is untouched: the
`required` schema field, the `MAX_TASTE_NOTE_CHARS` clamp, and the always-generated rule are all
unchanged — only the card's presentation moved from expanded-only to always-visible. The "Supersedes
the truncation-aware chevron" note above is now moot: with no chevron at all there is nothing to show
or hide, and the truncation-aware-hide idea stays dropped. (Bare printed prices also gained a
client-side `$` prefix via `displayPrice` — see the Client-behavior update.)

## Verification

1. `npx tsc --noEmit` — green.
2. `npm run lint` — green.
3. Word-diff of `_shared/menu.ts` confirms the `PROMPT` and `MENU_SCHEMA` changes are pure
   insertions — no pre-existing extraction sentence altered.
4. **Live, after the `scan-menu` redeploy** (redeploy requires the user's own explicit instruction;
   must re-pass `verify_jwt: false`):
   - Scan a menu with printed descriptions → cards show the printed text verbatim.
   - Scan a menu without printed descriptions → cards show the model's typical blurb.
   - **Rescan the same menu → drinks come back with `imageUrl` cache hits.** Cache hits prove the
     keys did not move, i.e. the added prompt/schema text did not perturb `menu_description`
     extraction. This is the key-stability regression check.

## Out of scope

- Persisting or caching `typical_description` — it is display-only and recomputed each scan.
- Bumping `IMAGE_KEY_VERSION` or touching the image cache — keys are deliberately unchanged.
- Results search stays name-only; it does not match `description`.
- Truncation-aware chevron (hiding it when the text already fits in 3 collapsed lines) — needs
  two-pass text measurement; deliberately skipped.
