export interface CategoryChipProps {
  /** Circular watercolor artwork (see assets/category-*.png). */
  image: string;
  /** Hand-written label under the circle. */
  label: string;
  onPress?: () => void;
  /** Circle diameter in px. Default 150. */
  size?: number;
}
