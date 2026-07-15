// Home category chip data — the drink categories shown on the Home screen.

import type { CategoryArtKind } from '@/components/category-art';

// The five chip ids double as the scanner's forced-choice categories — every
// scanned drink is sorted into exactly one of these buckets.
export const DRINK_CATEGORY_IDS = ['shots', 'beer', 'exotic', 'cocktails', 'wine'] as const;
export type DrinkCategory = (typeof DRINK_CATEGORY_IDS)[number];

// Results-page category order — drives the results chips, the grouped list, and
// image generation order. The Home screen keeps the CATEGORIES order.
export const RESULTS_CATEGORY_ORDER: readonly DrinkCategory[] = ['cocktails', 'exotic', 'wine', 'beer', 'shots'];

// Chip artwork is either a raster crop from the design handoff (`image`) or
// a palette-matched vector drawing (`art`) for categories the handoff never
// illustrated.
export type Category = { id: DrinkCategory; label: string } & (
  | { image: number }
  | { art: CategoryArtKind }
);

export const CATEGORIES: Category[] = [
  {
    id: 'shots',
    label: 'Shots',
    art: 'shots',
  },
  {
    id: 'beer',
    label: 'Beer',
    image: require('@/assets/images/sipelle/category-beer.png'),
  },
  {
    id: 'exotic',
    label: 'Exotic',
    image: require('@/assets/images/sipelle/category-exotic.png'),
  },
  {
    id: 'cocktails',
    label: 'Cocktails',
    art: 'cocktails',
  },
  {
    id: 'wine',
    label: 'Wine',
    art: 'wine',
  },
];
