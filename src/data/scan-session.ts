import { useSyncExternalStore } from 'react';

import { generateDrinkImage } from '@/ai/drink-image';
import { scanMenuPhoto, type DrinkNutrition, type MenuScan } from '@/ai/menu-scan';
import { hasOpenRouterKey } from '@/ai/openrouter';

// In-memory store for the current scan. It holds no persisted state — the
// photo, the OCR result, and each drink's image live only for this session.
// A results screen subscribes via useScanSession and re-renders as images
// arrive. Re-scanning bumps runToken so any in-flight pipeline is orphaned.

export type DrinkImageStatus = 'queued' | 'generating' | 'done' | 'error';

export type SessionDrink = {
  id: string;
  name: string;
  visualDescription: string;
  price: string | null;
  nutrition: DrinkNutrition;
  imageStatus: DrinkImageStatus;
  imageUri: string | null;
};

export type ScanSession =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'error'; message: string }
  | { status: 'ready'; venueName: string | null; drinks: SessionDrink[] };

const IMAGE_CONCURRENCY = 3;

let session: ScanSession = { status: 'idle' };
let photoBase64: string | null = null;
let runToken = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ScanSession {
  return session;
}

function setSession(next: ScanSession): void {
  session = next;
  listeners.forEach((listener) => listener());
}

function updateDrink(id: string, patch: Partial<SessionDrink>): void {
  if (session.status !== 'ready') {
    return;
  }
  setSession({
    ...session,
    drinks: session.drinks.map((drink) =>
      drink.id === id ? { ...drink, ...patch } : drink,
    ),
  });
}

export function useScanSession(): ScanSession {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

async function generateOne(token: number, drink: SessionDrink): Promise<void> {
  if (token !== runToken) {
    return;
  }
  updateDrink(drink.id, { imageStatus: 'generating' });
  try {
    const imageUri = await generateDrinkImage(drink);
    if (token === runToken) {
      updateDrink(drink.id, { imageStatus: 'done', imageUri });
    }
  } catch {
    if (token === runToken) {
      updateDrink(drink.id, { imageStatus: 'error' });
    }
  }
}

async function generateImages(token: number, drinks: SessionDrink[]): Promise<void> {
  let cursor = 0;
  async function worker(): Promise<void> {
    while (token === runToken) {
      const index = cursor;
      cursor += 1;
      if (index >= drinks.length) {
        return;
      }
      await generateOne(token, drinks[index]);
    }
  }
  const workers: Promise<void>[] = [];
  for (let i = 0; i < IMAGE_CONCURRENCY; i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
}

async function run(): Promise<void> {
  const token = ++runToken;
  const base64 = photoBase64;
  if (base64 === null) {
    return;
  }
  if (!hasOpenRouterKey()) {
    setSession({
      status: 'error',
      message: 'Add your OpenRouter API key to .env.local, then restart the dev server.',
    });
    return;
  }
  setSession({ status: 'scanning' });
  let scan: MenuScan;
  try {
    scan = await scanMenuPhoto(base64);
  } catch (error) {
    if (token === runToken) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong scanning the menu.';
      setSession({ status: 'error', message });
    }
    return;
  }
  if (token !== runToken) {
    return;
  }
  if (scan.drinks.length === 0) {
    setSession({
      status: 'error',
      message: 'No drinks found on that photo. Try a clearer shot of the menu.',
    });
    return;
  }
  const drinks: SessionDrink[] = scan.drinks.map((drink, index): SessionDrink => ({
    ...drink,
    id: 'drink-' + index,
    imageStatus: 'queued',
    imageUri: null,
  }));
  setSession({ status: 'ready', venueName: scan.venueName, drinks });
  await generateImages(token, drinks);
}

export function beginScan(base64Jpeg: string): void {
  photoBase64 = base64Jpeg;
  void run();
}

export function retryScan(): void {
  if (photoBase64 !== null) {
    void run();
  }
}

export function retryDrinkImage(id: string): void {
  if (session.status !== 'ready') {
    return;
  }
  const drink = session.drinks.find((item) => item.id === id);
  if (drink && drink.imageStatus === 'error') {
    void generateOne(runToken, drink);
  }
}
