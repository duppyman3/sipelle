// Menu-scan prompt, schema, and normalization — ported verbatim from the former
// in-app scanner (src/ai/menu-scan.ts). Kept server-side so the prompt and schema
// can't be lifted from the app bundle.

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
};

const PROMPT =
  'Read this photo of a restaurant drink menu. Extract up to 30 alcoholic drinks, ' +
  'skipping food and plain soft drinks unless the menu is entirely mocktails. Use the ' +
  'exact printed name for each drink. Estimate nutrition per standard serving. Set ' +
  'venue_name only if it is visible on the menu, otherwise null. Sort every drink into ' +
  'exactly one category of shots, beer, exotic, cocktails, or wine — pick the closest ' +
  'fit, and use exotic for anything unusual or hard to place (cider, sake, hard seltzer, ' +
  'port, mead).';

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
      maxItems: 30,
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
  },
  required: ['venue_name', 'drinks'],
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

export function normalizeMenuScan(raw: RawMenuScan): MenuScan {
  const venueName =
    typeof raw.venue_name === 'string' && raw.venue_name.trim().length > 0 ? raw.venue_name.trim() : null;

  const drinks = (raw.drinks ?? [])
    .map(normalizeDrink)
    .filter((drink): drink is ScannedDrink => drink !== null)
    .slice(0, 30);

  return { venueName, drinks };
}

function normalizeDrink(raw: RawDrink): ScannedDrink | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name.length === 0) {
    return null;
  }
  return {
    name,
    category: normalizeCategory(raw.category),
    visualDescription: typeof raw.visual_description === 'string' ? raw.visual_description.trim() : '',
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
