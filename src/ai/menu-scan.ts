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
  /** The backend's HMAC over this drink — drink-image won't render without it. */
  sig: string;
  /** Cache key for this drink's image, passed back to drink-image. Absent on older backends. */
  imageKey?: string;
  /** The backend's HMAC binding imageKey to this drink; pairs with imageKey. Absent on older backends. */
  keySig?: string;
  /** Public URL of an already-generated image — present only on a server-side cache hit. */
  imageUrl?: string;
};

export type MenuScan = {
  venueName: string | null;
  drinks: ScannedDrink[];
  /** The model's count of every drink on the menu, before the extraction cap. Absent on older backends. */
  totalDrinkCount?: number | null;
  /** The backend's per-scan extraction cap. Absent on older backends. */
  drinkLimit?: number;
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
