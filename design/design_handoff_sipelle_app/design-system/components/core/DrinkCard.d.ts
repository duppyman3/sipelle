export interface DrinkCardProps {
  /** Drink illustration; rendered on a white rounded tile (see assets/drink-*.png). */
  image: string;
  /** Drink name, serif. */
  name: string;
  /** 0–5, halves allowed. */
  rating: number;
  /** One short line, sentence case, no period needed. */
  description: string;
  /** Formatted price, e.g. "$14". */
  price: string;
  onPress?: () => void;
}
