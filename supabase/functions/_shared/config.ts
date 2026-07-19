// Tunables for the AI edge functions. Daily caps are enforced per device and per
// IP (see rate-limit.ts); the timeouts and input limits mirror the former in-app client.

export type Kind = 'scan' | 'image';

/**
 * Per-day request caps, checked against the device id, the client IP, and a global
 * total. The global tier is a deliberately conservative pre-launch ceiling on total
 * spend — it binds well before the per-IP caps do, and survives an attacker rotating
 * device ids or IPs. Raise it as real usage grows.
 */
export const DAILY_CAPS = {
  device: { scan: 20, image: 600 },
  ip: { scan: 60, image: 1800 },
  global: { scan: 300, image: 1200 },
} as const;

/** Respond before the 150s gateway idle timeout, so total work is capped here. */
export const HARD_DEADLINE_MS = 140_000;

/** Per-attempt upstream timeouts — parity with the former client. */
export const SCAN_TIMEOUT_MS = 90_000;
export const IMAGE_TIMEOUT_MS = 120_000;

/** A base64 JPEG longer than this is rejected before we touch OpenRouter. */
export const MAX_IMAGE_BASE64_CHARS = 10_000_000;
export const MAX_NAME_CHARS = 120;
export const MAX_VISUAL_DESCRIPTION_CHARS = 600;
/** The printed menu description feeds the image cache key; longer text is clamped. */
export const MAX_MENU_DESCRIPTION_CHARS = 400;
/** The AI-written fallback display description; display-only, clamped like the printed one. */
export const MAX_TYPICAL_DESCRIPTION_CHARS = 400;
/** The one-sentence taste summary; display-only. */
export const MAX_TASTE_NOTE_CHARS = 300;

/** Device ids are generated client-side; keep in sync with src/data/device-id.ts. */
export const DEVICE_ID_PATTERN = /^[a-z0-9-]{8,64}$/;

/** How long a drink signature stays valid, so harvested signatures decay. */
export const SIGNATURE_TTL_SECONDS = 86_400;
