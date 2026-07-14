# PostHog AI-Spend Tracking — Design

**Date:** 2026-07-13
**Status:** Approved (design approved in-session; implementation pending)

## Goal

Track the real USD spend of every OpenRouter call made with this project's API key, in the
existing Sipelle PostHog project (US Cloud), and see it graphed with no dashboard-building —
via PostHog's built-in **LLM Analytics** tab.

Scoping to "just this project's key" is structural: the only consumer of the
`OPENROUTER_API_KEY` function secret is the two Supabase Edge Functions (`scan-menu`,
`drink-image`), both of which route through `supabase/functions/_shared/openrouter.ts` →
`postOpenRouter()`. Instrument that one choke point and every tracked dollar is this
project's key, and nothing else ever is.

## Verified platform facts (2026-07-13)

- **OpenRouter includes `usage` with exact USD `cost` automatically on every response.**
  The old `usage: { include: true }` opt-in is deprecated and unnecessary. Applies to
  `/chat/completions` (fields: `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost`)
  and to `/images` (`usage` is optional — "when available" — e.g.
  `{ prompt_tokens, completion_tokens, total_tokens, cost }`). The `/images` response has
  **no generation `id`**, so a `/generation` lookup fallback is impossible; cost capture for
  images is best-effort from the response body only.
  Docs: https://openrouter.ai/docs/cookbook/administration/usage-accounting,
  https://openrouter.ai/docs/guides/overview/multimodal/image-generation
- **PostHog manual LLM capture:** POST to `https://us.i.posthog.com/i/v0/e/` with body
  `{ api_key, event: "$ai_generation", properties: { distinct_id, ... } }`, authenticated by
  the public project key (`phc_…`) alone. Cost properties (`$ai_total_cost_usd`) are used
  as-is when provided. `$ai_input` / `$ai_output_choices` may be omitted (equivalent to
  PostHog privacy mode) — cost/token/model graphs all still work.
  Docs: https://posthog.com/docs/llm-analytics/manual-capture,
  https://posthog.com/docs/api/capture
- **LLM Analytics activates automatically** once `$ai_generation` events arrive: Costs,
  Generations, Users, Latency graphs, filterable by any `$ai_*` property. First 100K LLM
  events/month free (30-day retention of large `$ai_` props; irrelevant here since we omit
  them).

## Architecture

```
scan-menu ──┐                                          ┌─► OpenRouter (unchanged)
            ├─► postOpenRouter(path, body, timeout, ───┤
drink-image ┘        meta?: {deviceId, spanName})      └─► EdgeRuntime.waitUntil(
                                                             captureAiGeneration(...))
                                                               → POST us.i.posthog.com/i/v0/e/
```

### New module: `supabase/functions/_shared/posthog.ts`

One exported function, `captureAiGeneration(props)`:
- Builds the `$ai_generation` event and POSTs it to `https://us.i.posthog.com/i/v0/e/`.
- Constants `POSTHOG_API_KEY` (the public `phc_wmH2F6SoMnvbNXMZ6paLpVeZXNXSWQCjFeK5S2FCBsYp`,
  already committed in `eas.json` — public by design) and the host URL live in this module
  (single consumer; `_shared/config.ts` stays reserved for behavioral tunables).
- Entire body wrapped so **no failure ever propagates**: swallow all errors, no retries,
  short timeout (~5s AbortController). Analytics must never slow or break a scan.

### Hook: `supabase/functions/_shared/openrouter.ts`

`postOpenRouter` gains an optional 4th parameter `meta?: { deviceId: string; spanName: string }`.
When present:
- Record `t0` before the fetch; on completion compute `$ai_latency` in seconds.
- **Success:** parse the JSON as today, then read `usage` and `model` loosely
  (`(data as { usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }; model?: string })`)
  — no changes to `ChatCompletion` or `ImageResponse` types. Model falls back to
  `(body as { model?: string }).model` when the response has none (the `/images` case).
- **Failure (UpstreamError):** capture the same event with `$ai_is_error: true`,
  `$ai_error` = the error message, `$ai_http_status` = status, no cost (failures are not
  billed).
- Dispatch via `EdgeRuntime.waitUntil(...)` so the user response is never delayed.
- Retry behavior needs no special handling: `runScan`/`generateImage` retries call
  `postOpenRouter` again, so each attempt (failed first try, billed second try) is its own
  event — which is the correct accounting.

### Event schema

| Property | Value |
|---|---|
| event | `$ai_generation` |
| `distinct_id` | the request's `deviceId` (same identity as app analytics → per-user spend) |
| `$ai_trace_id` | `crypto.randomUUID()` per request |
| `$ai_span_name` | `'scan-menu'` or `'drink-image'` (split spend by feature) |
| `$ai_provider` | `'openrouter'` |
| `$ai_model` | response `model`, else request-body `model` |
| `$ai_input_tokens` / `$ai_output_tokens` | from `usage` (omit if absent) |
| `$ai_total_cost_usd` | `usage.cost` (omit if absent — never guess) |
| `$ai_latency` | seconds, measured around the fetch |
| `$ai_http_status` | 200, or upstream status on error (0 → omit) |
| `$ai_base_url` | `https://openrouter.ai/api/v1` |
| `$ai_is_error` / `$ai_error` | only on UpstreamError |

**Omitted by design:** `$ai_input`, `$ai_output_choices` — no menu photos, prompts, drink
names, or model output ever reach PostHog.

### Call-site changes (one line each)

- `scan-menu/index.ts` → both `postOpenRouter` calls in `runScan` pass
  `{ deviceId, spanName: 'scan-menu' }` (thread `deviceId` into `runScan`).
- `drink-image/index.ts` → both `postOpenRouter` calls in `generateImage` pass
  `{ deviceId, spanName: 'drink-image' }` (thread `deviceId` into `generateImage`).

## Rollout

1. Deploy both functions via `mcp__supabase__deploy_edge_function` to project
   `cmoaqgkzotvuvkqeyhhq` — **must re-pass `verify_jwt: false`** (tool defaults to `true`,
   which 401s the app).
2. Verify: trigger one real scan (app or curl with the publishable key), then confirm the
   generation rows and dollar costs appear under PostHog → LLM Analytics, and that the
   normal scan response is unaffected.

## Known limits

- Tracking starts at deploy — historical spend is not backfilled (OpenRouter's Activity
  page retains it; programmatic backfill would need a management key, out of scope).
- If an `/images` response omits `usage`, the event records the generation without cost
  rather than guessing.
- Local-dev scans (same deployed functions) are indistinguishable from production usage in
  the spend graphs. Acceptable pre-launch; revisit only if it ever muddies the data.

## Out of scope

- No custom PostHog dashboard (built-in LLM Analytics is the deliverable).
- No `@supabase/supabase-js` or PostHog SDK in the functions — plain `fetch`, matching the
  app's pattern.
- No app (client) changes at all.
