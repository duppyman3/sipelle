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
- **Routing**: expo-router ~57.0.4, file-based routes in `src/app/` only (no co-located components). Single Stack (`_layout.tsx`, headers hidden, fade transitions): `index` (splash) → `welcome` (first-run name onboarding) → `home` → `results`. **Typed routes ON** — after adding a route, regenerate declarations with `npx expo customize tsconfig.json` (or a dev-server start) before typechecking.
- **TypeScript** ~6.0.3 strict; aliases `@/*` → `./src/*`, `@/assets/*` → `./assets/*`. **React Compiler ON** — with Reanimated shared values use `.set()`/`.get()` outside worklets (never `.value` in render scope) and keep animation builders at module scope.
- **Animation**: react-native-reanimated 4.5 (+ react-native-worklets) exclusively — entrance builders and press timing live in `src/constants/motion.ts`; the shared press affordance is `src/components/pressable-scale.tsx` (scale 0.97, 120ms).
- **UI**: expo-image for images, expo-linear-gradient (Home wash), CSS `boxShadow` string style prop (never legacy shadow*/elevation), `borderCurve: 'continuous'` on rounded rects, react-native-safe-area-context for insets (Android is always edge-to-edge), inline styles.
- **Fonts**: @expo-google-fonts/playfair-display + @expo-google-fonts/caveat (600 weights) via `useFonts`, gating expo-splash-screen in the root layout. Body text is the system font.
- **Icons/art**: lucide-react-native (1.x for React 19) over react-native-svg 15.15.4; custom vector chip art in `src/components/category-art.tsx`.
- **Persistence**: expo-sqlite's synchronous **localStorage polyfill** (never AsyncStorage), wrapped in `src/data/user-name.ts` and `src/data/device-id.ts`. The polyfill import is platform-split (`src/data/install-storage.ts` / empty `.web.ts`) — a direct import breaks the dev web bundle on unresolvable wasm. Guard all access with `typeof localStorage === 'undefined'` (static export renders in Node).
- **Data**: static venue/menu data in `src/data/menu.ts`. AI menu-scan and drink-image calls go through `src/ai/backend.ts` → the Supabase Edge Functions (see Backend below).
- **Checks** (no test framework yet): `npx tsc --noEmit`, `npx expo lint` (eslint-config-expo), bundle smoke tests via `npx expo export --platform android` and `--platform web`.

## Backend (Supabase)

- **Project**: dedicated Supabase project **Sipelle** — ref `cmoaqgkzotvuvkqeyhhq`, URL https://cmoaqgkzotvuvkqeyhhq.supabase.co (Postgres 17, us-east-1, created 2026-07-12).
- **Server-side AI flow**: the OpenRouter scan/image calls run in two Edge Functions — `scan-menu` and `drink-image` (source of truth in `supabase/functions/`, deployed via the MCP tools). They deploy with **`verify_jwt: false`** plus an in-code check that the request `apikey` matches a project publishable key — **every redeploy must re-pass `verify_jwt: false`** (the MCP tool defaults it back to `true`, which 401s the app). Per-device and per-IP daily caps are enforced by the `rate_limits` table + `consume_ai_quota()` RPC (service-role only; RLS on with no policies). `OPENROUTER_API_KEY` lives ONLY as a function secret (Supabase dashboard-managed — there is no MCP tool for secrets, so it never enters the repo or bundle).
- **Access for agents**: use the Supabase MCP tools (`mcp__supabase__*`) with that project id for all SQL, migrations, and edge functions — no connection string needed. The same org holds unrelated projects (MenuGallery, CurlFreely, FFLTransferFees); never target those from this repo.
- **Access for the app**: the app hits the Edge Functions with **plain `fetch`** and the publishable (anon) key in the `apikey` header — **not** `@supabase/supabase-js`, and it consumes no tables directly yet. Any future table access uses that publishable key with Row Level Security on every table; the direct Postgres connection string (`postgres` role) bypasses RLS and must never appear in the repo, the Expo bundle, or client code.
- **Secrets**: `.gitignore` only covers `.env*.local` — a plain `.env` WOULD be committed, so keep local secrets in `.env.local`, and **never create `supabase/functions/.env` or `supabase/.env`** (they would be committed too).

## Website (www.sipelle.app)

- Companion marketing/support site for the app. **Source is NOT in this repo** — it lives at `D:\GITHUB\sipelle_website` (GitHub `duppyman3/sipelle_website`; flat HTML/CSS on Cloudflare, own CLAUDE.md). Make website changes there, never here.
- **This repo is the design upstream**: the website's `design-system/` is a byte-identical copy of `design/design_handoff_sipelle_app` (plus a web-only `WEB-NOTES.md`). After changing the design handoff here, re-copy it into the website repo — the copies must not drift.
- Live pages: `/` (landing), `/privacy` (privacy policy), `/terms` (terms of service), `/support` (contact info@sipelle.app) — extensionless URLs are canonical (`.html` forms 307-redirect to them). `src/app/paywall.tsx` links to `https://www.sipelle.app/terms` and `/privacy`. The terms copy was finalized 2026-07-14 (effective July 14, 2026; entity Nicholas Titus; Florida law; contact info@sipelle.app — email only, no mailing address).
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
