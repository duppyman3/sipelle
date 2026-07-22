// Menu-scan prompt, schema, and normalization — ported verbatim from the former
// in-app scanner (src/ai/menu-scan.ts). Kept server-side so the prompt and schema
// can't be lifted from the app bundle.

import {
  MAX_MENU_DESCRIPTION_CHARS,
  MAX_NAME_CHARS,
  MAX_TASTE_NOTE_CHARS,
  MAX_TYPICAL_DESCRIPTION_CHARS,
  MAX_VISUAL_DESCRIPTION_CHARS,
  SIGNATURE_TTL_SECONDS,
} from '../_shared/config.ts';
import { signDrink, signImageKey } from '../_shared/signature.ts';
import { computeImageKey } from '../_shared/image-cache.ts';

// The single source of the per-scan extraction cap — feeds the prompt, the schema's
// maxItems, the normalization slice, and the response's drinkLimit. If raising it,
// also revisit the explicit max_tokens in buildScanBody so the longer list keeps output headroom.
export const SCAN_DRINK_LIMIT = 30;

// keep in sync with src/data/menu.ts DRINK_CATEGORY_IDS
const DRINK_CATEGORY_IDS = ['shots', 'beer', 'exotic', 'cocktails', 'wine'] as const;
type DrinkCategory = (typeof DRINK_CATEGORY_IDS)[number];

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
  /** The description printed on the menu, verbatim — feeds the image cache key. Null when none is printed. */
  menuDescription: string | null;
  /** Card display text: the printed description when the menu has one, else the AI-written typical blurb. */
  description: string | null;
  /** One-sentence taste summary shown under the card's description. */
  tasteNote: string | null;
  price: string | null;
  nutrition: DrinkNutrition;
};

export type MenuScan = {
  venueName: string | null;
  drinks: ScannedDrink[];
  /** The model's count of every drink printed on the menu, before the extraction cap. */
  totalDrinkCount: number | null;
};

/**
 * A drink carrying our HMAC, which drink-image requires before it will render anything.
 * `imageKey`/`keySig` let the client request or reuse a cached image; `imageUrl` is
 * present only when scan-menu already found the image in the cache. `menuDescription`
 * stays server-side (it only feeds the cache key), so it is omitted from the wire drink;
 * the display-only `description` rides the wire in its place as the card's display text.
 */
export type SignedDrink = Omit<ScannedDrink, 'menuDescription'> & {
  sig: string;
  imageKey: string;
  keySig: string;
  imageUrl?: string;
};

export type SignedMenuScan = {
  venueName: string | null;
  drinks: SignedDrink[];
  totalDrinkCount: number | null;
  /** The cap the client compares totalDrinkCount against, so it never hardcodes it. */
  drinkLimit: number;
};

const PROMPT =
  `Read this photo of a restaurant drink menu. Extract up to ${SCAN_DRINK_LIMIT} alcoholic drinks, ` +
  'skipping food and plain soft drinks unless the menu is entirely mocktails. Use the ' +
  'exact printed name for each drink. Copy the drink\'s printed description verbatim ' +
  'into menu_description, or null when no description is printed for it. Separately, ' +
  'write one or two short sentences into typical_description for every drink, describing ' +
  'its typical ingredients and character the way a menu blurb would. Then write ' +
  'taste_note for every drink as an expert mixologist would: one sentence (20-40 words) on ' +
  'what it tastes like — overall sweetness, tartness or bitterness, its most noticeable ' +
  'flavor notes, body, and finish — based on its printed or typical ingredients, naming ' +
  'only flavors most people would actually notice. Estimate ' +
  'nutrition per standard serving. Set ' +
  'venue_name only if it is visible on the menu, otherwise null. Sort every drink into ' +
  'exactly one category of shots, beer, exotic, cocktails, or wine — pick the closest ' +
  'fit, and use exotic for anything unusual or hard to place (cider, sake, hard seltzer, ' +
  'port, mead). Also count every alcoholic drink printed on the menu — including any ' +
  `beyond the ${SCAN_DRINK_LIMIT} you extract — and report that count as total_drink_count.`;

// Strict JSON schema: every object lists all properties in `required`, forbids extra
// properties, and expresses nullables as type arrays. Descriptions steer the model.
const MENU_SCHEMA = {
  type: 'object',
  properties: {
    venue_name: {
      type: ['string', 'null'],
      description: 'The venue or restaurant name if visible on the menu, otherwise null.',
    },
    drinks: {
      type: 'array',
      maxItems: SCAN_DRINK_LIMIT,
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The exact printed drink name.',
          },
          category: {
            type: 'string',
            enum: [...DRINK_CATEGORY_IDS],
            description:
              'The single closest-fit category. Use "exotic" for anything unusual or that fits nowhere else — cider, sake, hard seltzer, port, mead, punches.',
          },
          visual_description: {
            type: 'string',
            description:
              'How the drink typically looks when served — glassware, liquid color, garnish, and setting — written so an image model can paint it.',
          },
          menu_description: {
            type: ['string', 'null'],
            description:
              "The drink's description exactly as printed on the menu, copied verbatim. Null if the menu prints no description for it.",
          },
          typical_description: {
            type: 'string',
            description:
              "One or two short consumer-facing sentences on the drink's typical ingredients and " +
              'character, written like a menu blurb. Plain menu prose, never an appearance or ' +
              'image-generation prompt.',
          },
          taste_note: {
            type: 'string',
            description:
              'One sentence (20-40 words) on what the drink tastes like to an average person — ' +
              'overall sweetness, tartness, bitterness, notable flavor notes, body, alcohol warmth, ' +
              'and finish. Only flavors most people would actually notice; never a list of ingredients.',
          },
          price: {
            type: ['string', 'null'],
            description: 'The price exactly as printed, including any currency symbol. Null if no price is shown.',
          },
          nutrition: {
            type: 'object',
            properties: {
              calories: {
                type: ['number', 'null'],
                description: 'Rough estimate of calories for one standard serving.',
              },
              abv_percent: {
                type: ['number', 'null'],
                description: 'Rough estimate of alcohol by volume, as a percentage, for one standard serving.',
              },
              sugar_g: {
                type: ['number', 'null'],
                description: 'Rough estimate of sugar in grams for one standard serving.',
              },
              carbs_g: {
                type: ['number', 'null'],
                description: 'Rough estimate of carbohydrates in grams for one standard serving.',
              },
            },
            required: ['calories', 'abv_percent', 'sugar_g', 'carbs_g'],
            additionalProperties: false,
          },
        },
        required: ['name', 'category', 'visual_description', 'menu_description', 'typical_description', 'taste_note', 'price', 'nutrition'],
        additionalProperties: false,
      },
    },
    total_drink_count: {
      type: 'integer',
      description:
        'The total number of alcoholic drinks printed on the menu, counted before the ' +
        'extraction limit. Estimate if the menu is partially visible.',
    },
  },
  required: ['venue_name', 'drinks', 'total_drink_count'],
  additionalProperties: false,
};

export type ChatCompletion = {
  choices?: { message?: { content?: string } }[];
};

type RawNutrition = {
  calories?: number | null;
  abv_percent?: number | null;
  sugar_g?: number | null;
  carbs_g?: number | null;
};

type RawDrink = {
  name?: string | null;
  category?: string | null;
  visual_description?: string | null;
  menu_description?: string | null;
  typical_description?: string | null;
  taste_note?: string | null;
  price?: string | null;
  nutrition?: RawNutrition | null;
};

type RawMenuScan = {
  venue_name?: string | null;
  drinks?: RawDrink[] | null;
  total_drink_count?: number | null;
};

// Non-OpenAI fallback for when the primary model's upstream fails. Every OpenRouter
// provider serving it supports the structured-output/reasoning params require_parameters demands.
export const SCAN_FALLBACK_MODEL = 'google/gemini-2.5-flash';

export function buildScanBody(base64Jpeg: string, includeReasoning: boolean, model = 'openai/gpt-5.4-mini'): object {
  const body: Record<string, unknown> = {
    model,
    provider: { require_parameters: true },
    // Output headroom: worst case ~30 drinks of JSON plus reasoning/thinking tokens, which
    // count toward the completion cap on both the primary and fallback models. Far below
    // both models' output ceilings; a truncated response 502s at JSON.parse.
    max_tokens: 30_000,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'menu_scan',
        strict: true,
        schema: MENU_SCHEMA,
      },
    },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64Jpeg}` },
          },
        ],
      },
    ],
  };
  if (includeReasoning) {
    body.reasoning = { effort: 'minimal' };
  }
  return body;
}

/**
 * Signs every drink in a normalized scan, so drink-image can tell our text from a
 * caller's. The signatures are bound to the scanning device and expire, so they can't
 * be harvested and replayed indefinitely or from a rotated device id.
 */
export async function signMenuScan(scan: MenuScan, deviceId: string): Promise<SignedMenuScan> {
  const exp = Math.floor(Date.now() / 1000) + SIGNATURE_TTL_SECONDS;
  const drinks = await Promise.all(
    scan.drinks.map(async ({ menuDescription, ...drink }) => {
      const imageKey = await computeImageKey(drink.name, menuDescription);
      const [sig, keySig] = await Promise.all([
        signDrink(drink.name, drink.visualDescription, deviceId, exp),
        signImageKey(imageKey, drink.name, drink.visualDescription, deviceId, exp),
      ]);
      return { ...drink, sig, imageKey, keySig };
    }),
  );
  return { venueName: scan.venueName, drinks, totalDrinkCount: scan.totalDrinkCount, drinkLimit: SCAN_DRINK_LIMIT };
}

export function normalizeMenuScan(raw: RawMenuScan): MenuScan {
  const venueName =
    typeof raw.venue_name === 'string' && raw.venue_name.trim().length > 0 ? raw.venue_name.trim() : null;

  const drinks = (raw.drinks ?? [])
    .map(normalizeDrink)
    .filter((drink): drink is ScannedDrink => drink !== null)
    .slice(0, SCAN_DRINK_LIMIT);

  // Clamp so the reported total can never contradict the drinks we actually return.
  const reported = toNumberOrNull(raw.total_drink_count);
  const totalDrinkCount = reported === null ? null : Math.max(Math.round(reported), drinks.length);

  return { venueName, drinks, totalDrinkCount };
}

function normalizeDrink(raw: RawDrink): ScannedDrink | null {
  // Clamp to the same caps drink-image enforces: we sign these exact strings, so an
  // over-long one would be a validly signed drink the image endpoint then rejects.
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, MAX_NAME_CHARS) : '';
  if (name.length === 0) {
    return null;
  }
  const visualDescription =
    typeof raw.visual_description === 'string'
      ? raw.visual_description.trim().slice(0, MAX_VISUAL_DESCRIPTION_CHARS)
      : '';
  const trimmedDescription =
    typeof raw.menu_description === 'string' ? raw.menu_description.trim().slice(0, MAX_MENU_DESCRIPTION_CHARS) : '';
  const menuDescription = trimmedDescription.length > 0 ? trimmedDescription : null;
  const trimmedTypical =
    typeof raw.typical_description === 'string'
      ? raw.typical_description.trim().slice(0, MAX_TYPICAL_DESCRIPTION_CHARS)
      : '';
  const trimmedTaste =
    typeof raw.taste_note === 'string' ? raw.taste_note.trim().slice(0, MAX_TASTE_NOTE_CHARS) : '';
  return {
    name,
    category: normalizeCategory(raw.category),
    visualDescription,
    menuDescription,
    description: menuDescription ?? (trimmedTypical.length > 0 ? trimmedTypical : null),
    tasteNote: trimmedTaste.length > 0 ? trimmedTaste : null,
    price: typeof raw.price === 'string' && raw.price.trim().length > 0 ? raw.price.trim() : null,
    nutrition: normalizeNutrition(raw.nutrition),
  };
}

function normalizeCategory(value: string | null | undefined): DrinkCategory {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (DRINK_CATEGORY_IDS as readonly string[]).includes(id) ? (id as DrinkCategory) : 'exotic';
}

function normalizeNutrition(raw: RawNutrition | null | undefined): DrinkNutrition {
  return {
    calories: toNumberOrNull(raw?.calories),
    abvPercent: toNumberOrNull(raw?.abv_percent),
    sugarGrams: toNumberOrNull(raw?.sugar_g),
    carbsGrams: toNumberOrNull(raw?.carbs_g),
  };
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
