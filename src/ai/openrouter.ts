// Minimal OpenRouter client for the Sipelle proof of concept. The API key is
// inlined into the client bundle by Expo — this must stay a static dot-notation
// read of process.env so the value is substituted at build time.
const API_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1';

/** An OpenRouter failure. `status` is the HTTP status, or 0 for a network/timeout/parse error. */
export class OpenRouterError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
  }
}

/** True when a non-empty OpenRouter API key is bundled into the app. */
export function hasOpenRouterKey(): boolean {
  return typeof API_KEY === 'string' && API_KEY.trim().length > 0;
}

/** POSTs a JSON body to an OpenRouter endpoint and returns the parsed response, throwing OpenRouterError on failure. */
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
        Authorization: `Bearer ${API_KEY ?? ''}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://www.sipelle.app',
        'X-OpenRouter-Title': 'Sipelle',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new OpenRouterError('The request timed out. Check your connection and try again.', 0);
    }
    throw new OpenRouterError('Network error. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new OpenRouterError(await readErrorMessage(res), res.status);
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
