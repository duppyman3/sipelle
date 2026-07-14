# PostHog AI-Spend Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every OpenRouter call made by the Sipelle Edge Functions reports its exact USD cost to PostHog as a `$ai_generation` event, lighting up the built-in LLM Analytics spend graphs.

**Architecture:** One new fire-and-forget capture module (`_shared/posthog.ts`); one hook in the single OpenRouter choke point (`_shared/openrouter.ts::postOpenRouter`, new optional `meta` param); two one-line threading changes in the function entrypoints. Deploy both functions, verify live.

**Tech Stack:** Supabase Edge Functions (Deno, TypeScript), PostHog HTTP capture API (US Cloud), OpenRouter API. No new dependencies, no SDKs — plain `fetch`.

**Spec:** `docs/superpowers/specs/2026-07-13-posthog-ai-spend-design.md` (read it first).

## Global Constraints

- **NEVER run `git commit`** — the project owner commits manually (project rule overrides this skill's commit steps).
- No test framework exists in this repo and none is to be added; verification is live end-to-end (Task 4).
- Deploys MUST pass `verify_jwt: false` — the MCP tool defaults to `true`, which 401s the app.
- Supabase project id: `cmoaqgkzotvuvkqeyhhq`. Never target any other project.
- Never send `$ai_input` / `$ai_output_choices` to PostHog (no photos, prompts, drink content).
- Analytics must never throw, retry, or delay the response path.
- Deno code style matches existing `_shared` modules: doc comments on exports, no semicolon/style deviations.

---

### Task 1: Capture module `_shared/posthog.ts`

**Files:**
- Create: `supabase/functions/_shared/posthog.ts`

**Interfaces:**
- Consumes: nothing from this codebase.
- Produces: `export type AiGeneration` and `export async function captureAiGeneration(gen: AiGeneration): Promise<void>` — consumed by Task 2 exactly as declared below.

- [ ] **Step 1: Write the file** with exactly this content:

```ts
// Fire-and-forget PostHog LLM-analytics capture ($ai_generation events → the
// LLM Analytics tab). The key is the same public project token the app ships
// in eas.json — public by design. Events carry cost/token/latency metadata
// only: no menu photos, prompts, or model output ever leave the function.
const POSTHOG_HOST = 'https://us.i.posthog.com';
const POSTHOG_API_KEY = 'phc_wmH2F6SoMnvbNXMZ6paLpVeZXNXSWQCjFeK5S2FCBsYp';

export type AiGeneration = {
  deviceId: string;
  spanName: 'scan-menu' | 'drink-image';
  model: string;
  latencySeconds: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  httpStatus?: number;
  /** Present only when the OpenRouter call failed; marks the event $ai_is_error. */
  errorMessage?: string;
};

/** POSTs one $ai_generation event. Never throws and never retries — analytics
 * must not affect the request path. Callers should not await this on the
 * response path (use EdgeRuntime.waitUntil). */
export async function captureAiGeneration(gen: AiGeneration): Promise<void> {
  try {
    const properties: Record<string, unknown> = {
      distinct_id: gen.deviceId,
      $ai_trace_id: crypto.randomUUID(),
      $ai_span_name: gen.spanName,
      $ai_provider: 'openrouter',
      $ai_model: gen.model,
      $ai_latency: gen.latencySeconds,
      $ai_base_url: 'https://openrouter.ai/api/v1',
    };
    if (gen.inputTokens !== undefined) {
      properties.$ai_input_tokens = gen.inputTokens;
    }
    if (gen.outputTokens !== undefined) {
      properties.$ai_output_tokens = gen.outputTokens;
    }
    if (gen.costUsd !== undefined) {
      properties.$ai_total_cost_usd = gen.costUsd;
    }
    if (gen.httpStatus !== undefined) {
      properties.$ai_http_status = gen.httpStatus;
    }
    if (gen.errorMessage !== undefined) {
      properties.$ai_is_error = true;
      properties.$ai_error = gen.errorMessage;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: POSTHOG_API_KEY, event: '$ai_generation', properties }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Swallow everything — a lost analytics event must never surface to a user.
  }
}
```

- [ ] **Step 2: Sanity-check** — file compiles standalone in your head: only web-standard APIs (`fetch`, `AbortController`, `crypto.randomUUID`), no imports needed. Confirm no other file in `supabase/functions/` already defines a PostHog helper (there is none today).

### Task 2: Hook in `_shared/openrouter.ts`

**Files:**
- Modify: `supabase/functions/_shared/openrouter.ts` (whole file shown below; today it is 65 lines — `postOpenRouter` + `readErrorMessage`)

**Interfaces:**
- Consumes: `captureAiGeneration`, `AiGeneration` from Task 1.
- Produces: `postOpenRouter<T>(path, body, timeoutMs?, meta?: OpenRouterMeta)` where `export type OpenRouterMeta = { deviceId: string; spanName: 'scan-menu' | 'drink-image' }` — consumed by Task 3. Existing 3-arg callers keep compiling unchanged.

- [ ] **Step 1: Replace the file content** with exactly this (unchanged lines preserved verbatim — the class `UpstreamError`, headers, timeout handling, and `readErrorMessage` are untouched):

```ts
// Server-side OpenRouter client. Ported from the former in-app client
// (src/ai/openrouter.ts) — same transport, headers, and error handling — with the
// key now read from a function secret instead of the app bundle.
import { type AiGeneration, captureAiGeneration } from './posthog.ts';

const BASE_URL = 'https://openrouter.ai/api/v1';

/** An OpenRouter failure. `status` is the HTTP status, or 0 for a network/timeout/parse error. */
export class UpstreamError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

/** Attribution for spend analytics; when present, every attempt (success or
 * failure) is reported to PostHog off the response path. */
export type OpenRouterMeta = { deviceId: string; spanName: 'scan-menu' | 'drink-image' };

/** POSTs a JSON body to an OpenRouter endpoint and returns the parsed response, throwing UpstreamError on failure. */
export async function postOpenRouter<T>(
  path: '/chat/completions' | '/images',
  body: object,
  timeoutMs = 120_000,
  meta?: OpenRouterMeta,
): Promise<T> {
  const started = Date.now();
  const requestModel = (body as { model?: string }).model ?? 'unknown';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('OPENROUTER_API_KEY') ?? ''}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://www.sipelle.app',
        'X-OpenRouter-Title': 'Sipelle',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    const message = controller.signal.aborted
      ? 'The request timed out. Check your connection and try again.'
      : 'Network error. Check your connection and try again.';
    report(meta, { model: requestModel, latencySeconds: seconds(started), errorMessage: message });
    throw new UpstreamError(message, 0);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const message = await readErrorMessage(res);
    report(meta, {
      model: requestModel,
      latencySeconds: seconds(started),
      httpStatus: res.status,
      errorMessage: message,
    });
    throw new UpstreamError(message, res.status);
  }

  const data = (await res.json()) as T;
  const { usage, model } = data as {
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
    model?: string;
  };
  report(meta, {
    model: typeof model === 'string' ? model : requestModel,
    latencySeconds: seconds(started),
    httpStatus: res.status,
    inputTokens: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : undefined,
    outputTokens: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : undefined,
    costUsd: typeof usage?.cost === 'number' ? usage.cost : undefined,
  });
  return data;
}

function seconds(startedMs: number): number {
  return (Date.now() - startedMs) / 1000;
}

/** Dispatches the capture off the response path. EdgeRuntime.waitUntil keeps the
 * isolate alive for it after the response returns; falls back to fire-and-forget. */
function report(meta: OpenRouterMeta | undefined, gen: Omit<AiGeneration, 'deviceId' | 'spanName'>): void {
  if (!meta) {
    return;
  }
  const pending = captureAiGeneration({ ...gen, deviceId: meta.deviceId, spanName: meta.spanName });
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(pending);
  } else {
    void pending;
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    if (data.error?.message) {
      return data.error.message;
    }
  } catch {
    // Error body was not JSON — fall through to a generic message.
  }
  return `OpenRouter request failed (${res.status}).`;
}
```

- [ ] **Step 2: Behavior diff check** — confirm the only observable changes vs. the old file are: (a) optional 4th param; (b) error messages built before `throw` instead of inline (same strings); (c) `res.json()` awaited into a variable before return (same result, same propagation if it rejects — and note a JSON-parse rejection intentionally sends no event: there is no billing info to report). Everything else byte-identical in behavior.

### Task 3: Thread `meta` through the two entrypoints

**Files:**
- Modify: `supabase/functions/scan-menu/index.ts:78` (the `runScan` call) and `:104-121` (the `runScan` function)
- Modify: `supabase/functions/drink-image/index.ts:96` (the `generateImage` call) and `:114-147` (the `generateImage` function)

**Interfaces:**
- Consumes: `postOpenRouter(path, body, timeoutMs, meta)` from Task 2.
- Produces: nothing new — request/response contracts of both functions are unchanged.

- [ ] **Step 1: scan-menu** — change the call on line 78 from `response = await runScan(imageBase64, deadline);` to:

```ts
    response = await runScan(imageBase64, deadline, deviceId);
```

and replace the `runScan` function with:

```ts
async function runScan(base64Jpeg: string, deadline: number, deviceId: string): Promise<ChatCompletion> {
  const meta = { deviceId, spanName: 'scan-menu' } as const;
  try {
    return await postOpenRouter<ChatCompletion>(
      '/chat/completions',
      buildScanBody(base64Jpeg, true),
      SCAN_TIMEOUT_MS,
      meta,
    );
  } catch (err) {
    // Some providers reject the reasoning parameter (400 invalid_request, or 404
    // when require_parameters routing finds no matching endpoint). Retry once without
    // it, but only while enough of the response deadline remains.
    const remaining = deadline - Date.now();
    if (err instanceof UpstreamError && (err.status === 400 || err.status === 404) && remaining > 10_000) {
      return await postOpenRouter<ChatCompletion>(
        '/chat/completions',
        buildScanBody(base64Jpeg, false),
        Math.min(SCAN_TIMEOUT_MS, remaining),
        meta,
      );
    }
    throw err;
  }
}
```

- [ ] **Step 2: drink-image** — change the call on line 96 from `response = await generateImage(prompt);` to:

```ts
    response = await generateImage(prompt, deviceId);
```

and replace the `generateImage` function with:

```ts
async function generateImage(prompt: string, deviceId: string): Promise<ImageResponse> {
  const meta = { deviceId, spanName: 'drink-image' } as const;
  try {
    return await postOpenRouter<ImageResponse>(
      '/images',
      {
        model: 'openai/gpt-5-image-mini',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'low',
        output_format: 'jpeg',
        output_compression: 70,
      },
      IMAGE_TIMEOUT_MS,
      meta,
    );
  } catch (err) {
    // `size` and `output_format` are not advertised for this model and may be
    // rejected (400 invalid_request). Retry once with only the advertised params.
    if (err instanceof UpstreamError && err.status === 400) {
      return await postOpenRouter<ImageResponse>(
        '/images',
        {
          model: 'openai/gpt-5-image-mini',
          prompt,
          n: 1,
          quality: 'low',
          output_compression: 70,
        },
        IMAGE_TIMEOUT_MS,
        meta,
      );
    }
    throw err;
  }
}
```

- [ ] **Step 3: Confirm no other `postOpenRouter` call sites exist** — `grep -n postOpenRouter supabase/functions` must show only `_shared/openrouter.ts` and the four call sites above.

### Task 4: Deploy both functions and verify live

**Files:** none created/modified. Uses Supabase MCP tools + curl.

**Interfaces:**
- Consumes: the deployed code from Tasks 1–3.
- Produces: live `$ai_generation` events visible in PostHog LLM Analytics.

- [ ] **Step 1: Inspect current deployment shape** — `mcp__supabase__list_edge_functions` / `mcp__supabase__get_edge_function` for project `cmoaqgkzotvuvkqeyhhq` to mirror the existing file naming (entrypoint `index.ts` + `_shared/*` files) exactly.

- [ ] **Step 2: Deploy `scan-menu`** via `mcp__supabase__deploy_edge_function` with **`verify_jwt: false`** and ALL its files: `index.ts` plus `_shared/config.ts`, `_shared/cors.ts`, `_shared/auth.ts`, `_shared/rate-limit.ts`, `_shared/openrouter.ts`, `_shared/posthog.ts`, `_shared/menu.ts`, `_shared/signature.ts` (match the import graph — read `index.ts` imports and include every transitively imported `_shared` file).

- [ ] **Step 3: Deploy `drink-image`** the same way (its graph: `index.ts`, `_shared/config.ts`, `_shared/cors.ts`, `_shared/auth.ts`, `_shared/rate-limit.ts`, `_shared/openrouter.ts`, `_shared/posthog.ts`, `_shared/signature.ts`).

- [ ] **Step 4: Confirm `verify_jwt` is false** on both (`mcp__supabase__list_edge_functions` shows the flag). If true, redeploy — do not leave it wrong.

- [ ] **Step 5: Live scan test.** Generate a small menu-like JPEG and call scan-menu (PowerShell):

```powershell
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 400, 300
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$font = New-Object System.Drawing.Font 'Arial', 16
$g.DrawString("DRINKS`nMojito  `$12`nMargarita  `$11", $font, [System.Drawing.Brushes]::Black, 20, 20)
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$b64 = [Convert]::ToBase64String($ms.ToArray())
$body = @{ deviceId = 'plan-verify-20260713'; imageBase64 = $b64 } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri 'https://cmoaqgkzotvuvkqeyhhq.supabase.co/functions/v1/scan-menu' -Headers @{ apikey = 'sb_publishable_YCP1zVv5r6Y32DZIDewU3A_YLuAx747' } -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 6
```

Expected: HTTP 200 JSON with `venue_name`, `drinks[]` (each with `name`, `visualDescription`, `sig`). This proves the response path is unbroken.

- [ ] **Step 6: Live image test.** Take `drinks[0]` from Step 5's response and:

```powershell
$drink = $scan.drinks[0]   # from Step 5 ($scan = Invoke-RestMethod result)
$body = @{ deviceId = 'plan-verify-20260713'; name = $drink.name; visualDescription = $drink.visualDescription; sig = $drink.sig } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri 'https://cmoaqgkzotvuvkqeyhhq.supabase.co/functions/v1/drink-image' -Headers @{ apikey = 'sb_publishable_YCP1zVv5r6Y32DZIDewU3A_YLuAx747' } -ContentType 'application/json' -Body $body | Select-Object -ExpandProperty image | ForEach-Object { $_.Substring(0, 60) }
```

Expected: a `data:image/...;base64,...` prefix (HTTP 200).

- [ ] **Step 7: Check function logs** — `mcp__supabase__get_logs` (service `edge-function`) for both functions: no new errors beyond normal request logs.

- [ ] **Step 8: Confirm events in PostHog** — in PostHog (US Cloud) → LLM Analytics: two generations for distinct id `plan-verify-20260713` — one `scan-menu` (model `openai/gpt-5.4-mini`-family) and one `drink-image` (`openai/gpt-5-image-mini`), each with a nonzero `$ai_total_cost_usd` (image cost may legitimately be absent if OpenRouter omitted usage). This step is done by the user in the UI, or via browser automation if available.

## Self-review notes

- Spec coverage: capture module (Task 1), choke-point hook incl. error events + waitUntil (Task 2), deviceId threading (Task 3), deploy with verify_jwt:false + live verification (Task 4). Historical backfill and custom dashboards are explicitly out of scope in the spec. ✔
- The spec's "one-line changes" per call site became small function-signature threads — required because `deviceId` isn't in scope inside `runScan`/`generateImage`; behavior identical. ✔
- Type consistency: `AiGeneration`/`captureAiGeneration` (Task 1) match Task 2's imports; `OpenRouterMeta` (Task 2) matches Task 3's literals (`as const` keeps the spanName literal type). ✔
