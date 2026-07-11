import '@/data/install-storage';

// The import above installs a synchronous, SQLite-backed localStorage on
// native; on web the platform-split shim is empty and the browser's own
// localStorage is used. During static export routes render in Node, where
// no localStorage exists — hence the guards.

const STORAGE_KEY = 'sipelle.firstName';

export function getSavedFirstName(): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const value = localStorage.getItem(STORAGE_KEY);
  return value && value.trim().length > 0 ? value : null;
}

export function saveFirstName(name: string): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(STORAGE_KEY, name.trim());
}

export function clearFirstName(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}
