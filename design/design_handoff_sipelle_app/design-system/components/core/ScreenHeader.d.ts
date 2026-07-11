export interface ScreenHeaderProps {
  /** Screen title, set in the serif display face. */
  title: string;
  /** Back handler; the arrow renders only when provided. */
  onBack?: () => void;
  /** Custom back icon node (defaults to a plain left arrow). Use Lucide arrow-left. */
  backIcon?: React.ReactNode;
}
