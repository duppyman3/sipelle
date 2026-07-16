import { AiError, postAiFunction } from '@/ai/backend';
import { getDeviceId } from '@/data/device-id';

/** Generates one photoreal image of a drink and resolves to a base64 data URI. */
export async function generateDrinkImage(drink: {
  name: string;
  visualDescription: string;
  sig: string;
  imageKey?: string;
  keySig?: string;
}): Promise<string> {
  const result = await postAiFunction<{ image?: string }>('drink-image', {
    deviceId: getDeviceId(),
    name: drink.name,
    visualDescription: drink.visualDescription,
    sig: drink.sig,
    // Cache passthrough — send the key only with its signature, so the server
    // never trusts a key it didn't also sign.
    ...(drink.imageKey && drink.keySig
      ? { imageKey: drink.imageKey, keySig: drink.keySig }
      : {}),
  });
  if (!result?.image) {
    throw new AiError('No image was returned.', 0);
  }
  return result.image;
}
