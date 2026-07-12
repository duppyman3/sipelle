// Server-side OpenRouter client. Ported from the former in-app client
// (src/ai/openrouter.ts) — same transport, headers, and error handling — with the
// key now read from a function secret instead of the app bundle.
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

/** POSTs a JSON body to an OpenRouter endpoint and returns the parsed response, throwing UpstreamError on failure. */
export async function postOpenRouter<T>(
  path: '/chat/completions' | '/images',
  body: object,
  timeoutMs = 120_000,
): Promise<T> {
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
    if (controller.signal.aborted) {
      throw new UpstreamError('The request timed out. Check your connection and try again.', 0);
    }
    throw new UpstreamError('Network error. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new UpstreamError(await readErrorMessage(res), res.status);
  }

  return res.json() as Promise<T>;
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
