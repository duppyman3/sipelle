import { useSyncExternalStore } from 'react';

import '@/data/install-storage';

// Reactive nutrition-visibility preference. Unset means visible, so a fresh
// subscriber sees nutrition immediately and only an explicit false hides it.
// Guarded for the static-export render in Node, where localStorage is absent.

const STORAGE_KEY = 'sipelle.showNutrition';

let cached: boolean | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  if (cached !== null) {
    return cached;
  }
  cached = typeof localStorage === 'undefined' || localStorage.getItem(STORAGE_KEY) !== 'false';
  return cached;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useShowNutrition(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function setShowNutrition(value: boolean): void {
  cached = value;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  }
  listeners.forEach((listener) => listener());
}
