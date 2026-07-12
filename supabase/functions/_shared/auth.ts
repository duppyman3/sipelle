import { json } from '../_shared/cors.ts';

/**
 * Rejects a request whose `apikey` header is not one of the project's publishable
 * keys. We accept any value present in SUPABASE_PUBLISHABLE_KEYS (current and next)
 * so the app keeps working across a key-rotation window. Returns a 401 Response to
 * send back, or null when the key checks out.
 *
 * This replaces gateway JWT verification (functions are deployed verify_jwt=false):
 * modern sb_publishable_ keys can't be gateway-verified, and the real protection is
 * the server-side prompts plus the rate limiter.
 */
export function requirePublishableKey(req: Request): Response | null {
  const apikey = req.headers.get('apikey');
  const publishable = Object.values(
    JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}') as Record<string, string>,
  );
  if (!apikey || !publishable.includes(apikey)) {
    return json(401, { error: 'Invalid API key.' });
  }
  return null;
}
