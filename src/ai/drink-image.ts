import { AiError, postAiFunction } from '@/ai/backend';
import { getDeviceId } from '@/data/device-id';

/** Generates one photoreal image of a drink and resolves to a base64 data URI. */
export async function generateDrinkImage(drink: { name: string; visualDescription: string }): Promise<string> {
  const result = await postAiFunction<{ image?: string }>('drink-image', {
    deviceId: getDeviceId(),
    name: drink.name,
    visualDescription: drink.visualDescription,
  });
  if (!result?.image) {
    throw new AiError('No image was returned.', 0);
  }
  return result.image;
}
