import { useSyncExternalStore } from 'react';

import '@/data/install-storage';

export const CURRENT_AGE_GATE_VERSION = 1;

const STORAGE_KEY = 'sipelle.legalAgeGateVersion';

let declinedForSession = false;
const listeners = new Set<() => void>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLegalAgeConfirmed(): boolean {
  return (
    typeof localStorage !== 'undefined' &&
    localStorage.getItem(STORAGE_KEY) === String(CURRENT_AGE_GATE_VERSION)
  );
}

export function useLegalAgeConfirmed(): boolean {
  return useSyncExternalStore(subscribe, getLegalAgeConfirmed, getLegalAgeConfirmed);
}

/** Returns true only for the first confirmation of the current gate version. */
export function confirmLegalAge(): boolean {
  if (getLegalAgeConfirmed()) {
    return false;
  }

  declinedForSession = false;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(CURRENT_AGE_GATE_VERSION));
  }
  emitChange();
  return true;
}

export function getLegalAgeDeclinedForSession(): boolean {
  return declinedForSession;
}

export function useLegalAgeDeclinedForSession(): boolean {
  return useSyncExternalStore(subscribe, getLegalAgeDeclinedForSession, getLegalAgeDeclinedForSession);
}

export function declineLegalAgeForSession(): void {
  if (declinedForSession) {
    return;
  }
  declinedForSession = true;
  emitChange();
}

export function clearLegalAgeForTesting(): void {
  declinedForSession = false;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
  emitChange();
}
