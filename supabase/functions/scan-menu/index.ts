import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  DEVICE_ID_PATTERN,
  HARD_DEADLINE_MS,
  MAX_IMAGE_BASE64_CHARS,
  SCAN_TIMEOUT_MS,
} from '../_shared/config.ts';
import { handleOptions, json } from '../_shared/cors.ts';
import { requirePublishableKey } from '../_shared/auth.ts';
import { clientIp, consumeQuota } from '../_shared/rate-limit.ts';
import { postOpenRouter, UpstreamError } from '../_shared/openrouter.ts';
import {
  buildScanBody,
  normalizeMenuScan,
  SCAN_FALLBACK_MODEL,
  signMenuScan,
  type ChatCompletion,
  type SignedMenuScan,
} from '../_shared/menu.ts';
import { lookupDrinkImages, publicImageUrl } from '../_shared/image-cache.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions();
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const unauthorized = requirePublishableKey(req);
  if (unauthorized) {
    return unauthorized;
  }

  // Reject oversized uploads before reading the body (base64 plus a little JSON overhead).
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > MAX_IMAGE_BASE64_CHARS + 500_000) {
    return json(413, { error: 'The photo is too large.' });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid request.' });
  }
  if (typeof payload !== 'object' || payload === null) {
    return json(400, { error: 'Invalid request.' });
  }

  const { deviceId, imageBase64 } = payload as Record<string, unknown>;
  if (
    typeof deviceId !== 'string' ||
    !DEVICE_ID_PATTERN.test(deviceId) ||
    typeof imageBase64 !== 'string' ||
    imageBase64.length < 100 ||
    imageBase64.length > MAX_IMAGE_BASE64_CHARS
  ) {
    return json(400, { error: 'Invalid request.' });
  }

  // Checked before the quota RPC so a misconfigured deploy doesn't burn a user's quota.
  if (!Deno.env.get('OPENROUTER_API_KEY') || !Deno.env.get('DRINK_SIGNING_SECRET')) {
    return json(500, { error: 'The AI service is not configured yet.' });
  }

  // No trustworthy IP means no IP quota, so refuse rather than let the caller past it.
  const ip = clientIp(req);
  if (ip === null) {
    return json(400, { error: 'Invalid request.' });
  }

  let quota;
  try {
    quota = await consumeQuota({ deviceId, ip, kind: 'scan' });
  } catch {
    return json(500, { error: 'Could not check usage limits. Try again shortly.' });
  }
  if (!quota.allowed) {
    return json(429, { error: 'Daily scan limit reached. Try again tomorrow.' });
  }

  const deadline = Date.now() + HARD_DEADLINE_MS;
  let response: ChatCompletion;
  try {
    response = await runScan(imageBase64, deadline, deviceId);
  } catch (err) {
    // Upstream text can name models, providers, and our billing state — log it, don't relay it.
    if (err instanceof UpstreamError) {
      console.error('openrouter upstream failure', { status: err.status, message: err.message });
      return json(err.status === 0 ? 504 : 502, { error: 'The menu could not be read. Try a clearer photo.' });
    }
    console.error('scan failure', err);
    return json(502, { error: 'The menu could not be read. Try a clearer photo.' });
  }

  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    return json(502, { error: 'The menu could not be read. Try a clearer photo.' });
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return json(502, { error: 'The menu could not be read. Try a clearer photo.' });
  }

  const scan = await signMenuScan(normalizeMenuScan(parsed), deviceId);
  await attachCachedImages(scan);
  return json(200, scan);
});

/**
 * Attaches `imageUrl` to every drink already in the cache, so the client renders it
 * without a drink-image call. A lookup failure must never fail the scan — the drinks
 * simply come back uncached and the client generates them.
 */
async function attachCachedImages(scan: SignedMenuScan): Promise<void> {
  const keys = [...new Set(scan.drinks.map((drink) => drink.imageKey))];
  let hits: Map<string, string>;
  try {
    hits = await lookupDrinkImages(keys);
  } catch (err) {
    console.error('drink image cache lookup failed', err);
    return;
  }
  for (const drink of scan.drinks) {
    const path = hits.get(drink.imageKey);
    if (path) {
      drink.imageUrl = publicImageUrl(path);
    }
  }
}

async function runScan(base64Jpeg: string, deadline: number, deviceId: string): Promise<ChatCompletion> {
  const meta = { deviceId, spanName: 'scan-menu' } as const;
  try {
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
  } catch (err) {
    // Any upstream failure escaping the attempts above — an OpenAI outage, or the primary
    // model being removed (a 404 that survives the no-reasoning retry) — degrades to one
    // attempt on the non-OpenAI fallback, while enough of the deadline remains.
    const remaining = deadline - Date.now();
    if (err instanceof UpstreamError && remaining > 10_000) {
      return await postOpenRouter<ChatCompletion>(
        '/chat/completions',
        buildScanBody(base64Jpeg, false, SCAN_FALLBACK_MODEL),
        Math.min(SCAN_TIMEOUT_MS, remaining),
        meta,
      );
    }
    throw err;
  }
}
