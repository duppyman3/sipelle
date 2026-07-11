// Static prototype data. A real build replaces this with the scanned venue's
// menu, per the design handoff's state-management notes.

export type Category = {
  id: string;
  label: string;
  image: number;
};

export type Drink = {
  id: string;
  name: string;
  price: string;
  rating: number;
  description: string;
  image: number;
};

export const CATEGORIES: Category[] = [
  {
    id: 'citrus',
    label: 'Citrus',
    image: require('@/assets/images/sipelle/category-citrus.png'),
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
];

export const VENUE_NAME = 'Union Square';

export const DRINKS: Drink[] = [
  {
    id: 'aperol-spritz',
    name: 'Aperol Spritz',
    price: '$14',
    rating: 5,
    description: 'Refreshing with prosecco and orange',
    image: require('@/assets/images/sipelle/drink-aperol-spritz.png'),
  },
  {
    id: 'dirty-martini',
    name: 'Dirty Martini',
    price: '$16',
    rating: 4,
    description: 'Classic gin with an olive twist',
    image: require('@/assets/images/sipelle/drink-dirty-martini.png'),
  },
  {
    id: 'mojito',
    name: 'Mojito',
    price: '$13',
    rating: 4,
    description: 'Cool mint, lime and white rum',
    image: require('@/assets/images/sipelle/drink-mojito.png'),
  },
];
