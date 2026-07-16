import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  DEVICE_ID_PATTERN,
  IMAGE_TIMEOUT_MS,
  MAX_NAME_CHARS,
  MAX_VISUAL_DESCRIPTION_CHARS,
} from '../_shared/config.ts';
import { handleOptions, json } from '../_shared/cors.ts';
import { requirePublishableKey } from '../_shared/auth.ts';
import { clientIp, consumeQuota } from '../_shared/rate-limit.ts';
import { postOpenRouter, UpstreamError } from '../_shared/openrouter.ts';
import { verifyDrink, verifyImageKey } from '../_shared/signature.ts';
import { lookupDrinkImages, publicImageUrl, storeDrinkImage } from '../_shared/image-cache.ts';

const IMAGE_KEY_PATTERN = /^[0-9a-f]{64}$/;

type ImageResponse = {
  data?: { b64_json?: string; media_type?: string }[];
};

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

  // Reject oversized bodies before reading them — this payload is a few hundred bytes of JSON.
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (contentLength > 10_000) {
    return json(413, { error: 'Invalid request.' });
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

  const { deviceId, name, visualDescription, sig, imageKey, keySig } = payload as Record<string, unknown>;
  if (
    typeof deviceId !== 'string' ||
    !DEVICE_ID_PATTERN.test(deviceId) ||
    typeof name !== 'string' ||
    name.trim().length === 0 ||
    name.length > MAX_NAME_CHARS ||
    typeof visualDescription !== 'string' ||
    visualDescription.length > MAX_VISUAL_DESCRIPTION_CHARS ||
    typeof sig !== 'string'
  ) {
    return json(400, { error: 'Invalid request.' });
  }

  // Cache fields are optional (old apps omit them) but must arrive together and well-formed.
  const cacheRequested = imageKey !== undefined || keySig !== undefined;
  if (
    cacheRequested &&
    (typeof imageKey !== 'string' || !IMAGE_KEY_PATTERN.test(imageKey) || typeof keySig !== 'string')
  ) {
    return json(400, { error: 'Invalid request.' });
  }
  const cacheKey = cacheRequested ? (imageKey as string) : null;
  const cacheKeySig = cacheRequested ? (keySig as string) : null;

  if (!Deno.env.get('OPENROUTER_API_KEY') || !Deno.env.get('DRINK_SIGNING_SECRET')) {
    return json(500, { error: 'The AI service is not configured yet.' });
  }

  // Only render drinks scan-menu authored, for the device it authored them for. Checked
  // before the quota RPC so a forged request can't cost us a database write or eat
  // someone else's IP quota. We verify the raw echoed strings, which scan-menu already
  // trimmed and clamped before signing — sign and verify must see identical bytes. The
  // error stays generic — no reason to tell a caller a signature scheme is what stopped them.
  if (!(await verifyDrink(name, visualDescription, deviceId, sig))) {
    return json(401, { error: 'Invalid request.' });
  }

  // The keySig binds this cache key to this exact drink text — without it a caller could
  // fetch or store one drink's image under another's key. Same generic error as a bad sig.
  if (cacheKey !== null && !(await verifyImageKey(cacheKey, name, visualDescription, deviceId, cacheKeySig!))) {
    return json(401, { error: 'Invalid request.' });
  }

  // No trustworthy IP means no IP quota, so refuse rather than let the caller past it.
  const ip = clientIp(req);
  if (ip === null) {
    return json(400, { error: 'Invalid request.' });
  }

  // A cache hit is free — checked before consumeQuota so the daily caps count only real
  // generations. Reuses the lookup RPC, which also records the use. A lookup failure just
  // falls through to generating.
  if (cacheKey !== null) {
    try {
      const path = (await lookupDrinkImages([cacheKey])).get(cacheKey);
      if (path) {
        return json(200, { image: publicImageUrl(path) });
      }
    } catch (err) {
      console.error('drink image cache lookup failed', err);
    }
  }

  let quota;
  try {
    quota = await consumeQuota({ deviceId, ip, kind: 'image' });
  } catch {
    return json(500, { error: 'Could not check usage limits. Try again shortly.' });
  }
  if (!quota.allowed) {
    return json(429, { error: 'Daily image limit reached. Try again tomorrow.' });
  }

  const prompt =
    `Professional beverage photograph of ${name}. ${visualDescription}. ` +
    'Served look, soft natural light, shallow depth of field, clean neutral background, photorealistic, appetizing.';

  let response: ImageResponse;
  let fromFallback: boolean;
  try {
    ({ response, fromFallback } = await generateImage(prompt, deviceId));
  } catch (err) {
    // Upstream text can name models, providers, and our billing state — log it, don't relay it.
    if (err instanceof UpstreamError) {
      console.error('openrouter upstream failure', { status: err.status, message: err.message });
      return json(err.status === 0 ? 504 : 502, { error: 'No image was returned.' });
    }
    console.error('image failure', err);
    return json(502, { error: 'No image was returned.' });
  }

  const image = response.data?.[0];
  if (!image?.b64_json) {
    return json(502, { error: 'No image was returned.' });
  }

  // Store the generation so the next scanner of this drink reuses it. If caching fails we
  // still return the image inline exactly as an old client would receive it — the cache
  // simply misses again next time. Fallback (FLUX) output is never cached — the shared
  // cache stays all-OpenAI JPEG; it serves inline like a cache-store failure would.
  if (cacheKey !== null && !fromFallback) {
    try {
      await storeDrinkImage(cacheKey, decodeBase64(image.b64_json), { name, visualDescription });
      return json(200, { image: publicImageUrl(`${cacheKey}.jpg`) });
    } catch (err) {
      console.error('drink image cache store failed', err);
    }
  }
  return json(200, { image: `data:${image.media_type ?? 'image/jpeg'};base64,${image.b64_json}` });
});

/** Base64 → bytes. atob yields one byte per char (0–255), correct for binary JPEG data. */
function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function generateImage(
  prompt: string,
  deviceId: string,
): Promise<{ response: ImageResponse; fromFallback: boolean }> {
  const meta = { deviceId, spanName: 'drink-image' } as const;
  try {
    try {
      return {
        response: await postOpenRouter<ImageResponse>(
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
        ),
        fromFallback: false,
      };
    } catch (err) {
      // `size` and `output_format` are not advertised for this model and may be
      // rejected (400 invalid_request). Retry once with only the advertised params.
      if (err instanceof UpstreamError && err.status === 400) {
        return {
          response: await postOpenRouter<ImageResponse>(
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
          ),
          fromFallback: false,
        };
      }
      throw err;
    }
  } catch (err) {
    // Fires on any upstream failure so an OpenAI outage degrades to a FLUX retry. FLUX takes
    // no size params — its default is today's 1024×1024 square — and we force jpeg output.
    if (err instanceof UpstreamError) {
      return {
        response: await postOpenRouter<ImageResponse>(
          '/images',
          {
            model: 'black-forest-labs/flux.2-klein-4b',
            prompt,
            n: 1,
            output_format: 'jpeg',
          },
          IMAGE_TIMEOUT_MS,
          meta,
        ),
        fromFallback: true,
      };
    }
    throw err;
  }
}
