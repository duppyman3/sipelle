import { useSyncExternalStore } from 'react';

import { generateDrinkImage } from '@/ai/drink-image';
import { scanMenuPhoto, type DrinkNutrition, type MenuScan } from '@/ai/menu-scan';
import { hasAiBackend, AiError } from '@/ai/backend';
import { track, trackError } from '@/analytics/posthog';
import { RESULTS_CATEGORY_ORDER, type DrinkCategory } from '@/data/menu';

// In-memory store for the current app session. Each scan's results replace the
// previous scan's — the drinks and the venue name both belong to the newest
// successful scan. The store resets only when the app restarts. scanToken gates
// both the activity status and the landing of results, so a stale overlapped
// scan is dropped whole. The image pipeline stays keyed by drink id, and since
// ids are never reused across scans, an image generation still in flight for a
// replaced drink settles as a harmless no-op.

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

export type ScanCapWarning = { totalDrinkCount: number; drinkLimit: number };

export type ScanSession = {
  activity: ScanActivity;
  venueName: string | null;
  drinks: SessionDrink[];
  capWarning: ScanCapWarning | null;
};

const IMAGE_CONCURRENCY = 3;

let session: ScanSession = { activity: { status: 'idle' }, venueName: null, drinks: [], capWarning: null };
let photoBase64: string | null = null;
let scanToken = 0;
let drinkSeq = 0;
let imageWorkers = 0;
const imageQueue: string[] = [];
const imageCache = new Map<string, string>();
const IMAGE_CACHE_MAX = 90;
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

// The AI can list the same drink twice on one photo — match names case- and
// whitespace-insensitively within a single scan's results so it isn't duplicated.
function drinkKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ');
}

// The image pipeline is keyed by drink id and carries no scan token. The
// per-drink 'queued' guard is what replaces the old tokens: enqueueing the same
// id twice simply no-ops. A fixed pool of IMAGE_CONCURRENCY drain loops caps
// concurrency globally across scans.
async function generateOne(id: string): Promise<void> {
  const drink = session.drinks.find((item) => item.id === id);
  if (!drink || drink.imageStatus !== 'queued') {
    return;
  }
  updateDrink(id, { imageStatus: 'generating' });
  try {
    const imageUri = await generateDrinkImage(drink);
    while (imageCache.size >= IMAGE_CACHE_MAX) {
      const oldest = imageCache.keys().next().value;
      if (oldest === undefined) break;
      imageCache.delete(oldest);
    }
    imageCache.set(drinkKey(drink.name), imageUri);
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
    // This error is for a photo where no drinks could be read at all.
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
  // Results belong to exactly one scan now, so only the newest scan may land
  // them — a slower stale scan is dropped whole, status and drinks alike.
  if (token !== scanToken) {
    return;
  }
  const seen = new Set<string>();
  const fresh: SessionDrink[] = [];
  for (const drink of scan.drinks) {
    const key = drinkKey(drink.name);
    if (!seen.has(key)) {
      seen.add(key);
      const cached = imageCache.get(key);
      fresh.push({
        ...drink,
        id: `drink-${++drinkSeq}`,
        imageStatus: cached ? 'done' : 'queued',
        imageUri: cached ?? null,
      });
    }
  }
  // Group by category up front so the stored list, the results screen, and the
  // image queue all share one order; stable sort keeps menu order within a group.
  fresh.sort(
    (a, b) => RESULTS_CATEGORY_ORDER.indexOf(a.category) - RESULTS_CATEGORY_ORDER.indexOf(b.category)
  );
  // The menu had more drinks than the backend may return — the results screen
  // shows a warning so a missing drink reads as the cap, not a broken app.
  const capWarning =
    typeof scan.totalDrinkCount === 'number' &&
    typeof scan.drinkLimit === 'number' &&
    scan.totalDrinkCount > scan.drinkLimit
      ? { totalDrinkCount: scan.totalDrinkCount, drinkLimit: scan.drinkLimit }
      : null;
  track('scan_succeeded', { drink_count: scan.drinks.length, new_drink_count: fresh.length, venue_detected: scan.venueName != null, total_drink_count: scan.totalDrinkCount ?? null, truncated: capWarning !== null });
  setSession({
    activity: { status: 'idle' },
    venueName: scan.venueName ?? null,
    drinks: fresh,
    capWarning,
  });
  enqueueImages(fresh.filter((drink) => drink.imageStatus === 'queued').map((drink) => drink.id));
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

// Backing out of the full-screen error returns to the results underneath —
// acknowledge the failure without retrying. Guarded on 'error' so a dismiss
// can never clobber a fresher scan that has already flipped to 'scanning'.
export function dismissScanError(): void {
  if (session.activity.status === 'error') {
    setSession({ ...session, activity: { status: 'idle' } });
  }
}

// Continue/Rescan on the cap warning acknowledges it for this scan's results;
// the landing setSession in run() re-arms it on every new scan.
export function dismissCapWarning(): void {
  if (session.capWarning !== null) {
    setSession({ ...session, capWarning: null });
  }
}

export function retryDrinkImage(id: string): void {
  const drink = session.drinks.find((item) => item.id === id);
  if (drink && drink.imageStatus === 'error') {
    updateDrink(id, { imageStatus: 'queued' });
    enqueueImages([id]);
  }
}
