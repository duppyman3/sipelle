/// <reference types="jest" />
// Versioned persistence and session-only decline state.

import {
  CURRENT_AGE_GATE_VERSION,
  clearLegalAgeForTesting,
  confirmLegalAge,
  declineLegalAgeForSession,
  getLegalAgeConfirmed,
  getLegalAgeDeclinedForSession,
} from '@/data/legal-age';

jest.mock('@/data/install-storage', () => ({}));

const values = new Map<string, string>();

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, String(value)),
  } satisfies Storage,
});

describe('legal-age state', () => {
  beforeEach(() => {
    values.clear();
    clearLegalAgeForTesting();
  });

  it('requires confirmation for a fresh install and an older gate version', () => {
    expect(getLegalAgeConfirmed()).toBe(false);

    localStorage.setItem('sipelle.legalAgeGateVersion', String(CURRENT_AGE_GATE_VERSION - 1));
    expect(getLegalAgeConfirmed()).toBe(false);
  });

  it('persists only the current gate version and confirms once', () => {
    expect(confirmLegalAge()).toBe(true);
    expect(confirmLegalAge()).toBe(false);
    expect(getLegalAgeConfirmed()).toBe(true);
    expect(localStorage.getItem('sipelle.legalAgeGateVersion')).toBe(String(CURRENT_AGE_GATE_VERSION));
    expect(localStorage.length).toBe(1);
  });

  it('recognizes a previously stored current-version confirmation', () => {
    localStorage.setItem('sipelle.legalAgeGateVersion', String(CURRENT_AGE_GATE_VERSION));
    expect(getLegalAgeConfirmed()).toBe(true);
  });

  it('keeps a decline in memory only and clears it for a new-process equivalent', () => {
    declineLegalAgeForSession();

    expect(getLegalAgeDeclinedForSession()).toBe(true);
    expect(getLegalAgeConfirmed()).toBe(false);
    expect(localStorage.length).toBe(0);

    clearLegalAgeForTesting();
    expect(getLegalAgeDeclinedForSession()).toBe(false);
  });
});
