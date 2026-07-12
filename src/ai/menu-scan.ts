import { AiError, postAiFunction } from '@/ai/backend';
import { getDeviceId } from '@/data/device-id';
import type { DrinkCategory } from '@/data/menu';

export type DrinkNutrition = {
  calories: number | null;
  abvPercent: number | null;
  sugarGrams: number | null;
  carbsGrams: number | null;
};

export type ScannedDrink = {
  name: string;
  category: DrinkCategory;
  visualDescription: string;
  price: string | null;
  nutrition: DrinkNutrition;
};

export type MenuScan = {
  venueName: string | null;
  drinks: ScannedDrink[];
};

/** Sends a menu photo (base64 JPEG) through the Sipelle backend and returns the extracted drinks. */
export async function scanMenuPhoto(base64Jpeg: string): Promise<MenuScan> {
  const result = await postAiFunction<MenuScan>('scan-menu', {
    deviceId: getDeviceId(),
    imageBase64: base64Jpeg,
  });
  if (!result || !Array.isArray(result.drinks)) {
    throw new AiError('The menu could not be read. Try a clearer photo.', 0);
  }
  return result;
}
