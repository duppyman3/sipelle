import { useSyncExternalStore } from 'react';

import '@/data/install-storage';

// ── Phase-2 swap boundary ──
// DEV STUB: the purchase below is simulated locally — this build must NOT
// ship to app stores. When RevenueCat lands, this module is the ONLY file
// that changes: keep every exported signature identical.
//   - sipelle.premium becomes a cold-start mirror of the RevenueCat
//     CustomerInfo 'premium' entitlement (updated from the SDK listener).
//   - purchasePremium(): Purchases.purchasePackage(annual); user-cancel →
//     { ok: false, reason: 'cancelled' }, other errors → 'failed'.
//   - restorePurchases(): Purchases.restorePurchases(); restored =
//     entitlement active after the call.
//   - usePremiumPrice(): store-localized priceString from the current
//     offering's annual package (the constant below is the fallback).
// The guard below makes that swap a release gate: any non-dev build fails at
// import rather than silently granting every user premium for $0.

if (!__DEV__) {
  throw new Error('premium.ts dev stub must be replaced with RevenueCat before release');
}

const FALLBACK_PRICE = '$2.99/year';
const STORAGE_KEY = 'sipelle.premium';

export type PurchaseResult = { ok: true } | { ok: false; reason: 'cancelled' | 'failed' };
export type RestoreResult = { ok: true; restored: boolean } | { ok: false; reason: 'failed' };

// Lazy read behind the localStorage guard: a static-export render in Node has
// no localStorage and must resolve to false rather than throw.
let cached: boolean | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  if (cached !== null) {
    return cached;
  }
  cached = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true';
  return cached;
}

function setEntitled(value: boolean): void {
  cached = value;
  if (typeof localStorage !== 'undefined') {
    if (value) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useIsPremium(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function usePremiumPrice(): string {
  return FALLBACK_PRICE;
}

export async function purchasePremium(): Promise<PurchaseResult> {
  await delay(1200);
  setEntitled(true);
  return { ok: true };
}

export async function restorePurchases(): Promise<RestoreResult> {
  await delay(800);
  return { ok: true, restored: getSnapshot() };
}

export function clearPremiumForTesting(): void {
  setEntitled(false);
}
