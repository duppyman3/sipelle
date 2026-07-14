// Home category chip data — the drink categories shown on the Home screen.

import type { CategoryArtKind } from '@/components/category-art';

// The five chip ids double as the scanner's forced-choice categories — every
// scanned drink is sorted into exactly one of these buckets.
export const DRINK_CATEGORY_IDS = ['cocktails', 'wine', 'exotic', 'beer', 'shots'] as const;
export type DrinkCategory = (typeof DRINK_CATEGORY_IDS)[number];

// Chip artwork is either a raster crop from the design handoff (`image`) or
// a palette-matched vector drawing (`art`) for categories the handoff never
// illustrated.
export type Category = { id: DrinkCategory; label: string } & (
  | { image: number }
  | { art: CategoryArtKind }
);

export const CATEGORIES: Category[] = [
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
  {
    id: 'exotic',
    label: 'Exotic',
    image: require('@/assets/images/sipelle/category-exotic.png'),
  },
  {
    id: 'beer',
    label: 'Beer',
    image: require('@/assets/images/sipelle/category-beer.png'),
  },
  {
    id: 'shots',
    label: 'Shots',
    art: 'shots',
  },
];
