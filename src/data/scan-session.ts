import { useSyncExternalStore } from 'react';

import { generateDrinkImage } from '@/ai/drink-image';
import { scanMenuPhoto, type DrinkNutrition, type MenuScan } from '@/ai/menu-scan';
import { hasAiBackend, AiError } from '@/ai/backend';
import { track, trackError } from '@/analytics/posthog';
import type { DrinkCategory } from '@/data/menu';

// In-memory store for the current app session. Drinks and the venue name
// accumulate across scans — a drink menu spans several pages, so every new photo
// adds to what's already been read, and the store resets only when the app
// restarts. scanToken gates only the activity status: the drinks and their image
// pipeline are keyed by drink id, so starting a new scan never orphans the image
// generation already in flight for earlier pages.

export type DrinkImageStatus = 'queued' | 'generating' | 'done' | 'error';

export type SessionDrink = {
  id: string;
  name: string;
  category: DrinkCategory;
  visualDescription: string;
  price: string | null;
  nutrition: DrinkNutrition;
  sig: string;
  imageStatus: DrinkImageStatus;
  imageUri: string | null;
};

export type ScanActivity =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'error'; message: string };

export type ScanSession = {
  activity: ScanActivity;
  venueName: string | null;
  drinks: SessionDrink[];
};

const IMAGE_CONCURRENCY = 3;

let session: ScanSession = { activity: { status: 'idle' }, venueName: null, drinks: [] };
let photoBase64: string | null = null;
let scanToken = 0;
let drinkSeq = 0;
let imageWorkers = 0;
const imageQueue: string[] = [];
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
  setSession({
    ...session,
    drinks: session.drinks.map((drink) => (drink.id === id ? { ...drink, ...patch } : drink)),
  });
}

export function useScanSession(): ScanSession {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// The same drink can show up on overlapping page photos — match names case- and
// whitespace-insensitively so a re-shot page doesn't duplicate it.
function drinkKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ');
}

// The image pipeline is keyed by drink id and carries no scan token. The
// per-drink 'queued' guard is what replaces the old tokens: enqueueing the same
// id twice simply no-ops. A fixed pool of IMAGE_CONCURRENCY drain loops caps
// concurrency globally, however many pages get scanned.
async function generateOne(id: string): Promise<void> {
  const drink = session.drinks.find((item) => item.id === id);
  if (!drink || drink.imageStatus !== 'queued') {
    return;
  }
  updateDrink(id, { imageStatus: 'generating' });
  try {
    const imageUri = await generateDrinkImage(drink);
    updateDrink(id, { imageStatus: 'done', imageUri });
  } catch (error) {
    track('drink_image_failed', { status: error instanceof AiError ? error.status : -1 });
    if (!(error instanceof AiError)) {
      trackError(error);
    }
    updateDrink(id, { imageStatus: 'error' });
  }
}

function enqueueImages(ids: string[]): void {
  imageQueue.push(...ids);
  while (imageWorkers < IMAGE_CONCURRENCY && imageQueue.length > 0) {
    void drainImages();
  }
}

async function drainImages(): Promise<void> {
  imageWorkers += 1;
  try {
    let id: string | undefined;
    while ((id = imageQueue.shift()) !== undefined) {
      await generateOne(id);
    }
  } finally {
    imageWorkers -= 1;
  }
}

async function run(): Promise<void> {
  const token = ++scanToken;
  const base64 = photoBase64;
  if (base64 === null) {
    return;
  }
  if (!hasAiBackend()) {
    setSession({
      ...session,
      activity: {
        status: 'error',
        message: 'Add the Supabase URL and publishable key to .env.local, then restart the dev server.',
      },
    });
    return;
  }
  setSession({ ...session, activity: { status: 'scanning' } });
  track('scan_started', { existing_drink_count: session.drinks.length });
  let scan: MenuScan;
  try {
    scan = await scanMenuPhoto(base64);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Something went wrong scanning the menu.';
    track('scan_failed', { status: error instanceof AiError ? error.status : -1, message });
    if (!(error instanceof AiError)) {
      // AiError is an expected operational failure; anything else is a bug.
      trackError(error);
    }
    // Only the newest scan owns the status, so an older overlapped scan can't
    // flip it to error under a fresher one.
    if (token === scanToken) {
      setSession({ ...session, activity: { status: 'error', message } });
    }
    return;
  }
  if (scan.drinks.length === 0) {
    track('scan_empty');
    // Reserved for a genuinely unreadable photo. An all-duplicates rescan lands
    // below with an empty `fresh` and settles quietly to idle instead.
    if (token === scanToken) {
      setSession({
        ...session,
        activity: {
          status: 'error',
          message: 'No drinks found on that photo. Try a clearer shot of the menu.',
        },
      });
    }
    return;
  }
  // Appending is never token-gated — a slower older scan still lands its drinks;
  // only the newest scan owns the activity status. venueName keeps the first
  // non-null value, since later pages usually crop the header off.
  const seen = new Set(session.drinks.map((drink) => drinkKey(drink.name)));
  const fresh: SessionDrink[] = [];
  for (const drink of scan.drinks) {
    const key = drinkKey(drink.name);
    if (!seen.has(key)) {
      seen.add(key);
      fresh.push({ ...drink, id: `drink-${++drinkSeq}`, imageStatus: 'queued', imageUri: null });
    }
  }
  track('scan_succeeded', { drink_count: scan.drinks.length, new_drink_count: fresh.length, venue_detected: scan.venueName != null });
  setSession({
    activity: token === scanToken ? { status: 'idle' } : session.activity,
    venueName: session.venueName ?? scan.venueName,
    drinks: [...session.drinks, ...fresh],
  });
  enqueueImages(fresh.map((drink) => drink.id));
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
  const drink = session.drinks.find((item) => item.id === id);
  if (drink && drink.imageStatus === 'error') {
    updateDrink(id, { imageStatus: 'queued' });
    enqueueImages([id]);
  }
}
