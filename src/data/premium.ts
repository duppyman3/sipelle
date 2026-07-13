import { useSyncExternalStore } from 'react';

import '@/data/install-storage';

// ── Phase-2 swap boundary ──
// DEV STUB: the purchase below is simulated locally, so it must never grant
// entitlement in a store build. PREMIUM_AVAILABLE is the release gate — __DEV__
// today, so release builds fail closed: getSnapshot() stays false, purchase and
// restore no-op, and callers render no premium UI or paywall path. When
// RevenueCat lands, this module is the ONLY file that changes: flip
// PREMIUM_AVAILABLE to always-true and keep every exported signature identical.
//   - sipelle.premium becomes a cold-start mirror of the RevenueCat
//     CustomerInfo 'premium' entitlement (updated from the SDK listener).
//   - purchasePremium(): Purchases.purchasePackage(annual); user-cancel →
//     { ok: false, reason: 'cancelled' }, other errors → 'failed'.
//   - restorePurchases(): Purchases.restorePurchases(); restored =
//     entitlement active after the call.
//   - usePremiumPrice(): store-localized priceString from the current
//     offering's annual package (the constant below is the fallback).

export const PREMIUM_AVAILABLE = __DEV__;

const FALLBACK_PRICE = '$2.99/year';
const STORAGE_KEY = 'sipelle.premium';

export type PurchaseResult = { ok: true } | { ok: false; reason: 'cancelled' | 'failed' };
export type RestoreResult = { ok: true; restored: boolean } | { ok: false; reason: 'failed' };

// Lazy read behind the localStorage guard: a static-export render in Node has
// no localStorage and must resolve to false rather than throw.
let cached: boolean | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  if (!PREMIUM_AVAILABLE) {
    return false;
  }
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
  if (!PREMIUM_AVAILABLE) {
    return { ok: false, reason: 'failed' };
  }
  await delay(1200);
  setEntitled(true);
  return { ok: true };
}

export async function restorePurchases(): Promise<RestoreResult> {
  if (!PREMIUM_AVAILABLE) {
    return { ok: true, restored: false };
  }
  await delay(800);
  return { ok: true, restored: getSnapshot() };
}

export function clearPremiumForTesting(): void {
  setEntitled(false);
}
