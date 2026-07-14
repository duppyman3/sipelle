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
