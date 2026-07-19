# Sipelle

## Project Purpose
A React Native phone app: photograph a restaurant alcoholic drink menu, then see AI-generated photos of every drink.
Website: https://www.sipelle.app/ — companion marketing/support site, separate repo (see Website section).

## Design System

The Sipelle design system lives at `design/design_handoff_sipelle_app/design-system/`:
- `readme.md` — brand/visual foundations (watercolor washes, type faces, color, iconography, copy rules)
- `tokens/*.css` — color/typography/spacing/effect tokens. The color hexes are authoritative; the px values are sampled at 2x mockup scale — exact device-point values come from the interactive prototype at `design/design_handoff_sipelle_app/reference/Sipelle App.dc.html` (390×844)
- `assets/` — watercolor PNG artwork. Caveat: the crops carry baked-in slices of the mockup background that mismatch app gradients on device — for new artwork prefer native/vector drawing in the brand style (pattern: `src/components/category-art.tsx`)
- `components/core/` — reference React components, each with `.d.ts` props and `.prompt.md` usage notes
- `SKILL.md` — makes the folder usable as a Claude Code skill

In app code, the tokens are already ported to `src/constants/theme.ts` (colors, fonts, shadows, layout) and the motion rules to `src/constants/motion.ts` — import from those rather than re-deriving values.

## Tech Stack

- **Expo SDK 57** (`expo ~57.0.4`), React Native 0.86, React 19.2.3 — versioned docs: https://docs.expo.dev/versions/v57.0.0/ (read before coding, per AGENTS.md). Everything must run in **Expo Go** (no custom native code); web works for dev verification only.
- **Routing**: expo-router ~57.0.4, file-based routes in `src/app/` only (no co-located components). Single Stack (`_layout.tsx`, headers hidden, fade transitions): `index` (splash) routes unconfirmed users to `age-gate`, while confirmed users continue to `welcome` (first-run name onboarding) or `home`; `welcome`, `home`, `results`, and `paywall` are guarded by `Stack.Protected`. **Typed routes ON** — after adding a route, regenerate declarations with `npx expo customize tsconfig.json` (or a dev-server start) before typechecking.
- **TypeScript** ~6.0.3 strict; aliases `@/*` → `./src/*`, `@/assets/*` → `./assets/*`. **React Compiler ON** — with Reanimated shared values use `.set()`/`.get()` outside worklets (never `.value` in render scope) and keep animation builders at module scope.
- **Animation**: react-native-reanimated 4.5 (+ react-native-worklets) exclusively — entrance builders and press timing live in `src/constants/motion.ts`; the shared press affordance is `src/components/pressable-scale.tsx` (scale 0.97, 120ms).
- **UI**: expo-image for images, expo-linear-gradient (Home wash), CSS `boxShadow` string style prop (never legacy shadow*/elevation), `borderCurve: 'continuous'` on rounded rects, react-native-safe-area-context for insets (Android is always edge-to-edge), inline styles.
- **Fonts**: @expo-google-fonts/playfair-display + @expo-google-fonts/caveat (600 weights) via `useFonts`, gating expo-splash-screen in the root layout. Body text is the system font.
- **Icons/art**: lucide-react-native (1.x for React 19) over react-native-svg 15.15.4; custom vector chip art in `src/components/category-art.tsx`.
- **Persistence**: expo-sqlite's synchronous **localStorage polyfill** (never AsyncStorage), wrapped in `src/data/user-name.ts`, `src/data/device-id.ts`, and `src/data/legal-age.ts`. The polyfill import is platform-split (`src/data/install-storage.ts` / empty `.web.ts`) — a direct import breaks the dev web bundle on unresolvable wasm. Guard all access with `typeof localStorage === 'undefined'` (static export renders in Node).
- **Data**: static venue/menu data in `src/data/menu.ts`. AI menu-scan and drink-image calls go through `src/ai/backend.ts` → the Supabase Edge Functions (see Backend below).
- **Checks**: `npx tsc --noEmit`, `npm run lint` (eslint-config-expo), `npm test` (Jest + React Native Testing Library), and bundle smoke tests via `npx expo export --platform android` and `--platform web`. Tests live outside the route tree in top-level `tests/`.

## Legal-age confirmation (live 2026-07-16)

- This is a **self-attestation gate**, not identity or date-of-birth verification. Sipelle stores only the accepted gate version under `sipelle.legalAgeGateVersion`; it does not collect or store a DOB, numeric age, jurisdiction, confirmation timestamp, or decline. `CURRENT_AGE_GATE_VERSION` in `src/data/legal-age.ts` is currently `1`; increment it when every install must confirm again.
- `index` and `age-gate` are public routes. `welcome`, `home`, `results`, and `paywall` are inside `Stack.Protected` with `useLegalAgeConfirmed()` as the guard, so unconfirmed deep links cannot enter the app. After confirming, users with a saved first name go to Home and users without one go to Welcome. Existing users are therefore gated once even when name onboarding was previously completed.
- Choosing "I'm not of legal drinking age" sets an in-memory flag only and replaces the gate with the adult-only blocked state plus Terms, Privacy, and `info@sipelle.app` support links. The block lasts for the current JavaScript process; a full cold restart asks again. Never persist or analyze declines.
- The gate shows "Enjoy responsibly. Never drink and drive." and links to `https://www.sipelle.app/terms` and `/privacy`. The same responsible-use message stays visible at the bottom of Home, including while the remote status kill-switch is showing System Down. The development-only reset button clears the name, premium stub, and legal-age confirmation.
- PostHog must not initialize or send lifecycle, screen, error, or custom events before confirmation. Root screen tracking also excludes `/age-gate`. A newly accepted gate emits exactly one `legal_age_confirmed` event with `{ gate_version: CURRENT_AGE_GATE_VERSION }`; gate views and declines emit nothing.
- Automated coverage in `tests/` includes versioned persistence, fresh and returning-user launch routing, protected routes/deep links, session-only decline behavior, legal/support links, zero pre-confirmation analytics, one-time confirmation tracking, maintenance-mode messaging, and the development reset.

## Backend (Supabase)

- **Project**: dedicated Supabase project **Sipelle** — ref `cmoaqgkzotvuvkqeyhhq`, URL https://cmoaqgkzotvuvkqeyhhq.supabase.co (Postgres 17, us-east-1, created 2026-07-12).
- **Server-side AI flow**: the OpenRouter scan/image calls run in two Edge Functions — `scan-menu` and `drink-image` (source of truth in `supabase/functions/`, deployed via the MCP tools). They deploy with **`verify_jwt: false`** plus an in-code check that the request `apikey` matches a project publishable key — **every redeploy must re-pass `verify_jwt: false`** (the MCP tool defaults it back to `true`, which 401s the app). Per-device and per-IP daily caps are enforced by the `rate_limits` table + `consume_ai_quota()` RPC (service-role only; RLS on with no policies). `OPENROUTER_API_KEY` lives ONLY as a function secret (Supabase dashboard-managed — there is no MCP tool for secrets, so it never enters the repo or bundle).
- **Scan item cap**: `scan-menu` returns at most **30 drinks per scan** — the single `SCAN_DRINK_LIMIT` constant in `supabase/functions/_shared/menu.ts` feeds the prompt, the schema `maxItems`, the normalization slice, and the response's `drinkLimit` field. On menus with more than 30 drinks the result truncates **near-randomly per scan** — verified live 2026-07-15 against a 63-drink menu: full-frame runs pin at 29-30 with a different surviving set each run, while a 17-item crop scanned 17/17 (model recall is perfect under the cap; legibility/compression/truncation ruled out). The decided mitigation (2026-07-15): the cap stays; the scan response additionally returns `totalDrinkCount` (the model's count of every drink printed on the menu, clamped to never contradict the returned list) plus `drinkLimit`, and when `totalDrinkCount > drinkLimit` the results screen shows a dismissable Rescan/Continue warning overlay (`src/components/scan-cap-modal.tsx`, `capWarning` state in `src/data/scan-session.ts`). Both fields are optional on the client, so old/new app-server pairs never crash. If ever raising the cap, also revisit the explicit `max_tokens` in `buildScanBody` — a longer list without output headroom hits the strict-`JSON.parse` 502 path in `scan-menu/index.ts` (which currently logs nothing), and expect roughly 2× `drink-image` volume per scan against `DAILY_CAPS`.
- **Image cache** (live 2026-07-16): generated drink images are shared across all users via the public `drink-images` Storage bucket + `drink_images` table, keyed by `sha256(JSON [IMAGE_KEY_VERSION, normalized name, normalized printed menu description])` in `supabase/functions/_shared/image-cache.ts` (name-only when no description is printed). `scan-menu` batch-checks all keys via the `lookup_drink_images` RPC (service-role only; it bumps `use_count`/`last_used_at` itself) and returns `imageUrl` inline on hits — the app renders those instantly and never calls `drink-image` for them. `drink-image` checks the cache **before** `consumeQuota` (hits are free; the daily image caps count only real generations), stores after generating, and falls back to returning base64 if caching fails. A second HMAC (`keySig`, domain tag `'imgkey'`, binding key+name+visualDescription+device+expiry in `_shared/signature.ts`) prevents cache poisoning; requests without `imageKey`/`keySig` (old app builds) get the pre-cache behavior byte-for-byte. Client side: drinks arriving with `imageUrl` land ready and are never enqueued (`src/data/scan-session.ts`), and the session name-keyed Map holds URLs as well as data URIs. Gotchas: (1) `drink_images.menu_description` is **NULL by design** — the key contains the description but `drink-image` (which writes the rows) never receives the text; don't "fix" it or read the column as evidence extraction failed (a hash-recompute proved extraction works — see the 2026-07-16 v8 detour). (2) Bump `IMAGE_KEY_VERSION` whenever the `drink-image` prompt template or model changes, so old-style images regenerate. (3) Never put brand-name examples in the scan prompt — the v8 experiment showed the model then spell-corrects printed text ("Bulliet"→"Bulleit"), destabilizing keys; verbatim extraction keeps keys deterministic (reverted in v9). Design doc: `docs/superpowers/specs/2026-07-15-drink-image-cache-design.md`.
- **Display description** (live 2026-07-19, after the next `scan-menu` redeploy): `scan-menu` returns a per-drink `description` for the card body — the printed menu description **verbatim** when the menu prints one, else the model-written `typical_description` (one or two "typical for this drink" sentences the model writes for **every** drink, `required` in the schema, clamped by `MAX_TYPICAL_DESCRIPTION_CHARS`). The merge is `menuDescription ?? typicalDescription` in `normalizeDrink` (`_shared/menu.ts`); `menuDescription` stays **off-wire** and still solely feeds `computeImageKey`, so cache keys are unchanged and there is **no `IMAGE_KEY_VERSION` bump** — the added prompt sentence and schema field are pure insertions with no brand-name examples, keeping verbatim extraction deterministic (rescans still hit the image cache, which is how key stability is verified). `visualDescription` is the image-generation prompt only and must **never** render on a card. `description` is optional on the client (`src/ai/menu-scan.ts`, `src/data/scan-session.ts`): old backends omit it, and the card then renders no description paragraph/chevron and never falls back to `visualDescription`. `buildScanBody` now sends `max_tokens: 30000` so the longer completion keeps output headroom. Scan additionally returns a per-drink `tasteNote` — an always-generated one-sentence (20–40-word) taste summary the model writes for **every** drink from a sensory checklist (sweetness, tartness/bitterness, notable flavor notes, body, alcohol warmth, finish), `required` in the schema and clamped by `MAX_TASTE_NOTE_CHARS`; the card renders it **only in its expanded state**, and it rides the wire and client (`ScannedDrink`/`SessionDrink`) optionally, exactly like `description`. Because every card now carries expanded-only content, the expand chevron is always meaningful. `tasteNote` is live on `scan-menu-v2` with the rest of this feature. Design doc: `docs/superpowers/specs/2026-07-19-drink-display-description-design.md`.
- **scan-menu-v2 (temporary, 2026-07-19)**: a deployment alias of `scan-menu` — the same repo source (`supabase/functions/scan-menu/index.ts` + `_shared/`), deployed under a second name so the `scan-menu` the Apple-review build calls stays frozen while the display-description feature is tested live. Deployed with **`verify_jwt: false`** like every function (not a code fork). The dev client points at it via the `SCAN_FN` constant in `src/ai/menu-scan.ts`; the reviewed app keeps hitting the untouched `scan-menu`. Post-review: redeploy `scan-menu` from the same source (re-pass `verify_jwt: false`), revert `SCAN_FN` to `'scan-menu'`, then retire `scan-menu-v2` in the dashboard (no MCP delete tool) — never while any shipped build still calls it, so the revert lands before the next store build.
- **OpenAI fallback models** (live 2026-07-16): both functions fail over automatically for an OpenAI outage — each request tries the OpenAI primary first, and if the whole primary attempt sequence throws an `UpstreamError` (covers 5xx/429/timeout and a pulled-model 404, at the cost of one extra call on non-outage errors like 402), it makes exactly one retry against a non-OpenAI backup: `scan-menu` → `google/gemini-2.5-flash` (`SCAN_FALLBACK_MODEL` in `_shared/menu.ts`; sends no reasoning param, but every provider serving it clears `require_parameters`), `drink-image` → `black-forest-labs/flux.2-klein-4b` on `/images` (`{ model, prompt, n: 1, output_format: 'jpeg' }`; no size param, rides BFL's default 1024×1024 square). Scan fallback only fires with ≥10s left before the response deadline. **Fallback-generated images are never cached** (style consistency — the cache holds canonical `gpt-5-image-mini` renditions) — they're served inline as data URIs, the same path a cache-store failure already takes; the drink gets a real cached JPEG next scan after OpenAI recovers. No `IMAGE_KEY_VERSION` bump, no client changes, no quota change (`consumeQuota` runs before generation, so fallbacks count against `DAILY_CAPS`). Design doc: `docs/superpowers/specs/2026-07-16-openai-fallback-models-design.md`.
- **Access for agents**: use the Supabase MCP tools (`mcp__supabase__*`) with that project id for all SQL, migrations, and edge functions — no connection string needed. The same org holds unrelated projects (MenuGallery, CurlFreely, FFLTransferFees); never target those from this repo. Note: deploying edge functions to this production project requires the user's own explicit instruction in the conversation — plan approval or agent-team delegation is not accepted by the permission system.
- **Access for the app**: the app hits the Edge Functions with **plain `fetch`** and the publishable (anon) key in the `apikey` header — **not** `@supabase/supabase-js`, and it consumes no tables directly yet. Any future table access uses that publishable key with Row Level Security on every table; the direct Postgres connection string (`postgres` role) bypasses RLS and must never appear in the repo, the Expo bundle, or client code.
- **Secrets**: `.gitignore` only covers `.env*.local` — a plain `.env` WOULD be committed, so keep local secrets in `.env.local`, and **never create `supabase/functions/.env` or `supabase/.env`** (they would be committed too).

## Remote status kill-switch (live 2026-07-16)

- The home screen checks `https://www.sipelle.app/status.json` on every screen focus and on app re-foreground (`src/data/app-status.ts`, wired in `src/app/home.tsx`). When the JSON's `status` trim+lowercases to `"offline"` or `"down"`, the category chips + Scan Menu button are replaced by `src/components/system-down-card.tsx` ("System Down" title + the JSON `message`); the greeting header stays visible.
- **To take the app down**: edit `status.json` in the website repo (`D:\GITHUB\sipelle_website`) — shape `{"status": "online" | "down" | "offline", "message": "shown to users"}`. Set it back to `"online"` to recover; users pick it up on next home focus or app re-foreground.
- **Deliberate decisions — don't re-suggest changing**: fail-open (any fetch error, timeout, non-2xx, or malformed JSON renders the normal UI; no status persisted) and home-only scope (`scanMenu()` and the results screen's Rescan are not gated). The `?t=${Date.now()}` cache-buster in `app-status.ts` is required — iOS NSURLSession + Cloudflare edge caching can otherwise serve a stale "down" after recovery. Optional website-side follow-up: `Cache-Control: no-cache` on status.json.

## Website (www.sipelle.app)

- Companion marketing/support site for the app. **Source is NOT in this repo** — it lives at `D:\GITHUB\sipelle_website` (GitHub `duppyman3/sipelle_website`; flat HTML/CSS on Cloudflare, own CLAUDE.md). Make website changes there, never here.
- **This repo is the design upstream**: the website's `design-system/` is a byte-identical copy of `design/design_handoff_sipelle_app` (plus a web-only `WEB-NOTES.md`). After changing the design handoff here, re-copy it into the website repo — the copies must not drift.
- Live pages: `/` (landing), `/privacy` (privacy policy), `/terms` (terms of service), `/support` (contact info@sipelle.app) — extensionless URLs are canonical (`.html` forms 307-redirect to them). The site also serves `/status.json`, the app's remote kill-switch (see the Remote status kill-switch section). `src/app/paywall.tsx` links to `https://www.sipelle.app/terms` and `/privacy`. The terms copy was finalized 2026-07-14 (effective July 14, 2026; entity Nicholas Titus; Florida law; contact info@sipelle.app — email only, no mailing address).
- The Edge Functions send `HTTP-Referer: https://www.sipelle.app` on OpenRouter calls (`supabase/functions/_shared/openrouter.ts`).




## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

## Execution Rules
Claude MUST start in Plan Mode.
Claude may modify existing .prd files without needing permission.


## Always Do First

- **Plan Mode** Always start in plan mode.

- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions. Design source of truth: the "MenuGallery" Claude Design system project (see Design Workflow above) and the color tokens in `src/constants.ts`.

- **agent teams** always invoke agent teams to do the work, you should use 3 team mates minimum, never do the work in the main context window. The main context window should only manage teams and agents.

- **Sequential Thinking** Use "Sequential Thinking" for complex decisions.

- **Never do a git commit** Unless expressly told my the user
@AGENTS.md
