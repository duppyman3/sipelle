export interface TabBarTab {
  id: string;
  label: string;
  /** Line icon node, ~32px, stroke 2. Lucide: house / search / circle-user-round. */
  icon: React.ReactNode;
}

export interface TabBarProps {
  tabs: TabBarTab[];
  activeId: string;
  onSelect?: (id: string) => void;
}
