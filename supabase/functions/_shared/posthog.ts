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
