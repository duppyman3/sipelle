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
import { verifyDrink } from '../_shared/signature.ts';

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

  const { deviceId, name, visualDescription, sig } = payload as Record<string, unknown>;
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

  // No trustworthy IP means no IP quota, so refuse rather than let the caller past it.
  const ip = clientIp(req);
  if (ip === null) {
    return json(400, { error: 'Invalid request.' });
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
  try {
    response = await generateImage(prompt);
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
  return json(200, { image: `data:${image.media_type ?? 'image/jpeg'};base64,${image.b64_json}` });
});

async function generateImage(prompt: string): Promise<ImageResponse> {
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
      );
    }
    throw err;
  }
}
