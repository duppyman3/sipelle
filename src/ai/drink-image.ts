import { OpenRouterError, postOpenRouter } from '@/ai/openrouter';

export type ImageQuality = 'low' | 'medium' | 'high';

type ImageResponse = {
  data?: { b64_json?: string; media_type?: string }[];
};

/** Generates one photoreal image of a drink and resolves to a base64 data URI. */
export async function generateDrinkImage(
  drink: { name: string; visualDescription: string },
  quality: ImageQuality = 'low',
): Promise<string> {
  const prompt =
    `Professional beverage photograph of ${drink.name}. ${drink.visualDescription}. ` +
    'Served look, soft natural light, shallow depth of field, clean neutral background, photorealistic, appetizing.';

  let response: ImageResponse;
  try {
    response = await postOpenRouter<ImageResponse>('/images', {
      model: 'openai/gpt-5-image-mini',
      prompt,
      n: 1,
      size: '1024x1024',
      quality,
      output_format: 'jpeg',
      output_compression: 70,
    });
  } catch (err) {
    // `size` and `output_format` are not advertised for this model and may be
    // rejected (400 invalid_request). Retry once with only the advertised params.
    if (err instanceof OpenRouterError && err.status === 400) {
      response = await postOpenRouter<ImageResponse>('/images', {
        model: 'openai/gpt-5-image-mini',
        prompt,
        n: 1,
        quality,
        output_compression: 70,
      });
    } else {
      throw err;
    }
  }

  const image = response.data?.[0];
  if (!image?.b64_json) {
    throw new OpenRouterError('No image was returned.', 0);
  }
  return `data:${image.media_type ?? 'image/jpeg'};base64,${image.b64_json}`;
}
