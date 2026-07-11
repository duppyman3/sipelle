export interface ScanActionProps {
  /** Accessible label; also drawn when no image is used. Default "Scan Menu". */
  label?: string;
  /** Icon node for the fallback render (use Lucide camera, stroke 2, ~56px). */
  icon?: React.ReactNode;
  onPress?: () => void;
  /** Preferred: the pre-rendered blob PNG (assets/scan-menu-blob.png). */
  image?: string;
  /** Width/height in px. Default 260. */
  size?: number;
}
