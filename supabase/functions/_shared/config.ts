// Tunables for the AI edge functions. Daily caps are enforced per device and per
// IP (see rate-limit.ts); the timeouts and input limits mirror the former in-app client.

export type Kind = 'scan' | 'image';

/** Per-day request caps, checked against both the device id and the client IP. */
export const DAILY_CAPS = {
  device: { scan: 20, image: 600 },
  ip: { scan: 60, image: 1800 },
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

/** Device ids are generated client-side; keep in sync with src/data/device-id.ts. */
export const DEVICE_ID_PATTERN = /^[a-z0-9-]{8,64}$/;
