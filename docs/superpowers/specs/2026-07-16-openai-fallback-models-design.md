# OpenAI Fallback Models — Design

**Date:** 2026-07-16
**Status:** Approved; implemented (both functions)

## Goal

Keep Sipelle working through an OpenAI outage. Both AI edge functions call OpenAI models
through OpenRouter — `scan-menu` reads menus with `openai/gpt-5.4-mini`, `drink-image` renders
drinks with `openai/gpt-5-image-mini`. When OpenAI is degraded (5xx/429/timeout) or a model is
pulled (404), every scan and every image fails and the app is effectively down, even though
OpenRouter can route the same work to other providers.

The fix: each request tries the OpenAI primary first, and if the whole primary attempt sequence
throws an `UpstreamError`, the function makes **exactly one** retry against a non-OpenAI backup
model. This is automatic and per-request — no human in the loop, no config flag to flip mid-outage.

Decisions locked with the user (2026-07-16):
- **Automatic failover, triggered on any `UpstreamError`** — not just 5xx/429/timeout. Firing on
  *any* upstream error also covers OpenAI deprecating a model (a 404 that survives the primary
  sequence), at the cost of one harmless extra attempt on non-outage errors like a 402 billing
  failure. One extra call on a rare error is cheaper than missing a real outage.
- **Scan backup** = `google/gemini-2.5-flash`. **Image backup** = `black-forest-labs/flux.2-klein-4b`.
- **Fallback-generated images are never written to the shared cache** — they are served inline as
  data URIs, the exact path a cache-store failure already takes today.
- **No `IMAGE_KEY_VERSION` bump, no client changes, no quota change.** Response shapes are
  identical; `consumeQuota` still runs before generation, so fallback generations count against
  the daily image caps like any real generation.

## scan-menu behavior

`supabase/functions/scan-menu/index.ts` (already implemented). The primary sequence and the
fallback are two nested wrappers around `postOpenRouter`:

- `runPrimaryScan` — attempt 1 sends `buildScanBody(base64, true)`: `openai/gpt-5.4-mini` with
  `provider: { require_parameters: true }`, the strict `menu_scan` JSON schema, and
  `reasoning: { effort: 'minimal' }`. On a `400` or `404` (some providers reject the reasoning
  param, or `require_parameters` routing finds no matching endpoint), and only while `>10s` of the
  response deadline remains, attempt 2 retries `buildScanBody(base64, false)` — same model, no
  reasoning.
- `runScan` — wraps that. If the whole primary sequence throws an `UpstreamError` and `>10s` of the
  deadline remains, it makes one fallback call: `buildScanBody(base64, false, SCAN_FALLBACK_MODEL)`
  where `SCAN_FALLBACK_MODEL = 'google/gemini-2.5-flash'` (`_shared/menu.ts:186`), timed out at
  `min(SCAN_TIMEOUT_MS, remaining)`.

The fallback body sends **no reasoning param**. `buildScanBody` still sends
`provider: { require_parameters: true }`, so the fallback model must have OpenRouter providers that
support `structured_outputs` + `response_format` (and, for the reasoning path, `reasoning`);
verified live on OpenRouter that every provider currently serving `google/gemini-2.5-flash` does —
otherwise `require_parameters` would 400 the fallback too. The `>10s` guard on both retries exists
because the outer function must still answer before `HARD_DEADLINE_MS` (140s); a fallback attempt
only fires when there is real time left to spend on it.

Everything downstream is unchanged: the fallback returns the same `ChatCompletion` shape, which
flows through `normalizeMenuScan` → `signMenuScan` → `attachCachedImages` exactly as a primary
response would. Callers can't tell which model read the menu.

## drink-image behavior

`supabase/functions/drink-image/index.ts` (`generateImage`, already implemented). The cache
lookup, quota, and prompt construction ahead of generation are untouched.

- **Primary sequence (unchanged):** attempt 1 posts to OpenRouter's dedicated Image API (`/images`)
  with `openai/gpt-5-image-mini` and full params (`n: 1, size: '1024x1024', quality: 'low',
  output_format: 'jpeg', output_compression: 70`). On a `400` (`size`/`output_format` are not
  advertised for this model), attempt 2 retries with only the advertised params.
- **Fallback:** if the primary sequence throws an `UpstreamError`, one retry against
  `black-forest-labs/flux.2-klein-4b` on the same `/images` endpoint. FLUX.2 Klein accepts only
  `output_format` (`png`|`jpeg`) / `n` (1 only) / `input_references` / `seed` — no
  `resolution`/`aspect_ratio`, so output size rides on Black Forest Labs' default (1024×1024
  square). The fallback body is
  `{ model: 'black-forest-labs/flux.2-klein-4b', prompt, n: 1, output_format: 'jpeg' }`.

The handler must know the returned image came from the fallback so it takes the **inline path** and
never touches the cache (see below). On success the response's reported `media_type` is used for the
data URI; FLUX is asked for `output_format: 'jpeg'`, so it returns as `data:image/jpeg;base64,…`.

## Cache policy rationale

Fallback images are deliberately kept out of the shared `drink-images` cache — the rule rests on
style consistency, not a file-format technicality:

- The cache is meant to hold canonical, primary-model (`gpt-5-image-mini`) renditions. An
  outage-time FLUX image is a stopgap for the users hitting the outage, not a canonical artifact to
  pin under a key that outlives the outage and is then served to every future scanner of that drink.
- The earlier PNG-mislabeling concern is now moot: `storeDrinkImage` (`_shared/image-cache.ts:106`)
  hard-codes `Content-Type: image/jpeg` and a `<image_key>.jpg` path, and FLUX is called with
  `output_format: 'jpeg'`, so it returns JPEG — nothing would be mislabeled. The no-cache rule
  stands on the style-consistency rationale alone.

So a fallback generation is returned inline as a data URI with the correct `media_type` and no
`storeDrinkImage` call. This is byte-for-byte the same code path a cache-store failure already
takes today (`drink-image/index.ts:149-157` falls through to `return json(200, { image: data:… })`
when the store throws), so it adds no new response shape. The drink simply misses the cache next
time; once OpenAI recovers, the next scanner of that drink generates a real `gpt-5-image-mini` JPEG
and populates the cache normally.

No `IMAGE_KEY_VERSION` bump: the primary model and prompt are unchanged, and fallback output never
enters the cache, so no already-stored image is invalidated.

## Alternatives considered

**Failover mechanism**
- *Manual kill-switch config flag* — a stored flag that reroutes to the backup model. Rejected: it
  needs a human to notice the outage and flip it mid-incident, and again to flip it back; automatic
  per-request failover recovers with zero intervention. (Distinct from the existing home-screen
  `status.json` kill-switch, which takes the whole app offline — the opposite of keeping it running.)
- *OpenRouter `models: [primary, fallback]` auto-routing* — let OpenRouter pick the fallback.
  Rejected: it silently falls back on non-outage errors, hiding real problems, and its support on
  the `/images` endpoint is unclear. Our explicit one-retry keeps the trigger and the backup model
  visible in our own code and logs.

**Scan backup model** (must serve under `provider: { require_parameters: true }`)
- `google/gemini-3.5-flash` — works but ~5× the price of 2.5-flash, and the fallback runs only
  during an outage, so paying more for the rare path isn't worth it.
- `anthropic/claude-haiku-4.5` — viable: it has full param support (reasoning + `structured_outputs`
  + `response_format`) on its Anthropic, Azure, and Amazon Bedrock providers, and `require_parameters`
  routing simply avoids its Google Vertex endpoints, which lack `structured_outputs`. Not chosen —
  the user preferred Gemini's OCR strength for reading menus.
- `qwen3-vl` — rejected: no OpenRouter provider serving it exposes the reasoning param, so the
  primary-style reasoning request (attempt 1) would 400 under `require_parameters`.

**Image backup model**
- `black-forest-labs/flux.2-klein-4b` — chosen. On the same `/images` endpoint `drink-image` already
  uses, at ~$0.014/megapixel output (~$0.0147/image at its default 1024×1024) — about 3× cheaper than
  Seedream, and per-megapixel billing caps cost even if the default size differed. It forces JPEG via
  `output_format: 'jpeg'`. Trade-off accepted: Black Forest Labs is a single, smaller provider than
  ByteDance — fine for a rarely-exercised outage path at ~3× less cost.
- `bytedance-seed/seedream-4.5` — rejected: a flat ~$0.04/image (~3× FLUX) for the same job, and it
  returns PNG.
- Gemini image models — no `output_format` param, and they return PNG, reintroducing the JPEG-cache
  mismatch we are avoiding.

## Cost notes

The fallback only runs during a primary outage, so steady-state cost is unchanged.

- **Scan fallback is cheaper than primary.** `gemini-2.5-flash` is $0.30/M in, $2.50/M out.
- **Image fallback is dearer per image:** ~$0.0147/image (FLUX, at its default 1024×1024) vs.
  ~$0.005/image (`gpt-5-image-mini`). It also means cache misses — each device regenerates a drink it would
  normally have gotten from the shared cache, because fallback images aren't stored. Both are bounded
  by the daily image caps (`DAILY_CAPS.global.image = 1200/day`, plus per-device and per-IP tiers),
  since `consumeQuota` runs before every generation including fallbacks. An outage is therefore
  capped-spend, not unbounded.

`$ai_generation` spend analytics keep working automatically: `postOpenRouter` reports every attempt
(`_shared/openrouter.ts:74-81`), so fallback attempts show up in LLM Analytics under their own model
name — the backup models appearing in that tab is itself the outage signal.

## Verification

1. `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform android` smoke test (edge
   functions are Deno, but the app bundle must still build clean).
2. **Force the fallback end-to-end.** Temporarily deploy each function with a deliberately broken
   primary model id (e.g. `openai/gpt-5.4-mini-BROKEN` in `buildScanBody`, `openai/gpt-5-image-mini-BROKEN`
   in `generateImage`) so the primary sequence throws `UpstreamError`:
   - Scan a real menu photo → confirm a full, correctly-shaped scan comes back (proving
     `gemini-2.5-flash` ran and satisfied `require_parameters` + the strict schema), and that the
     drinks render.
   - Confirm a drink image comes back and renders (proving the FLUX retry ran), and that **no**
     `drink_images` row / bucket object was written for it (check via MCP SQL) — fallback images
     stay out of the cache.
   - PostHog LLM Analytics shows `$ai_generation` events under `google/gemini-2.5-flash` and
     `black-forest-labs/flux.2-klein-4b`.
3. **Redeploy the real model ids.** Confirm the primary path works again and a fresh scan of the same
   drink now stores a normal `gpt-5-image-mini` JPEG in the cache.
4. Both deploys must re-pass `verify_jwt: false` — the MCP deploy tool defaults it back to `true`,
   which 401s the app. **Deploying these functions to the production project requires the user's own
   explicit instruction in the conversation** (plan approval or agent-team delegation is not accepted
   by the permission system); the broken-id verification above is a deploy and carries the same
   requirement.

## Out of scope

- Multi-model chains (more than one fallback), per-region routing, and OpenRouter provider pinning.
- Caching fallback images — out of scope on the style-consistency grounds above; revisit only if the
  outage path ever needs shared caching.
- Any client-side change: the app is agnostic to which model served a scan or image.
