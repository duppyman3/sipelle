// Thin client for the Sipelle backend (Supabase Edge Functions). Both values are
// public-by-design app config, inlined into the client bundle by Expo — they must
// stay static dot-notation reads of process.env so the values are substituted at
// build time.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** A Sipelle backend failure. `status` is the HTTP status, or 0 for a network/timeout/parse error. */
export class AiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AiError';
    this.status = status;
  }
}

/** True when the Supabase URL and publishable key are bundled into the app. */
export function hasAiBackend(): boolean {
  return (
    typeof SUPABASE_URL === 'string' &&
    SUPABASE_URL.trim().length > 0 &&
    typeof PUBLISHABLE_KEY === 'string' &&
    PUBLISHABLE_KEY.trim().length > 0
  );
}

/** POSTs a JSON body to a Sipelle Edge Function and returns the parsed response, throwing AiError on failure. */
export async function postAiFunction<T>(
  fn: 'scan-menu' | 'drink-image',
  body: object,
  timeoutMs = 150_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        apikey: PUBLISHABLE_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new AiError('The request timed out. Check your connection and try again.', 0);
    }
    throw new AiError('Network error. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new AiError(await readErrorMessage(res), res.status);
  }

  return res.json() as Promise<T>;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) {
      return data.error;
    }
  } catch {
    // Error body was not JSON — fall through to a generic message.
  }
  return `Request failed (${res.status}).`;
}
