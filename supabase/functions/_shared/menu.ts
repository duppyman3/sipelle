// Menu-scan prompt, schema, and normalization — ported verbatim from the former
// in-app scanner (src/ai/menu-scan.ts). Kept server-side so the prompt and schema
// can't be lifted from the app bundle.

import { MAX_NAME_CHARS, MAX_VISUAL_DESCRIPTION_CHARS, SIGNATURE_TTL_SECONDS } from '../_shared/config.ts';
import { signDrink } from '../_shared/signature.ts';

// The single source of the per-scan extraction cap — feeds the prompt, the schema's
// maxItems, the normalization slice, and the response's drinkLimit. If raising it,
// add an explicit max_tokens to buildScanBody so the longer list has output headroom.
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
  price: string | null;
  nutrition: DrinkNutrition;
};

export type MenuScan = {
  venueName: string | null;
  drinks: ScannedDrink[];
  /** The model's count of every drink printed on the menu, before the extraction cap. */
  totalDrinkCount: number | null;
};

/** A drink carrying our HMAC, which drink-image requires before it will render anything. */
export type SignedDrink = ScannedDrink & { sig: string };

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
  'exact printed name for each drink. Estimate nutrition per standard serving. Set ' +
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
        required: ['name', 'category', 'visual_description', 'price', 'nutrition'],
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
  price?: string | null;
  nutrition?: RawNutrition | null;
};

type RawMenuScan = {
  venue_name?: string | null;
  drinks?: RawDrink[] | null;
  total_drink_count?: number | null;
};

export function buildScanBody(base64Jpeg: string, includeReasoning: boolean): object {
  const body: Record<string, unknown> = {
    model: 'openai/gpt-5.4-mini',
    provider: { require_parameters: true },
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
    scan.drinks.map(async (drink) => ({
      ...drink,
      sig: await signDrink(drink.name, drink.visualDescription, deviceId, exp),
    })),
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
  return {
    name,
    category: normalizeCategory(raw.category),
    visualDescription,
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
