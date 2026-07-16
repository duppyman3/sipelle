import PostHog from 'posthog-react-native';

import { getDeviceId } from '@/data/device-id';
import { getLegalAgeConfirmed } from '@/data/legal-age';

// Public-by-design config, inlined by Expo at build time — must stay static
// dot-notation reads (same rule as src/ai/backend.ts).
const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST;

// PostHog's capture/screen/captureException want JSON-only props ({ [k]: JsonType }).
// The public functions below take Record<string, unknown> so callers stay decoupled
// from the SDK's types; this alias is derived from the installed SDK so the boundary
// cast can't drift if the signature changes.
type EventProperties = Parameters<PostHog['capture']>[1];

let client: PostHog | null = null;
let initialized = false;

// Lazy: callers are only effects/event handlers, so nothing constructs or
// networks during static-export renders in Node. Missing key => permanent no-op.
function getClient(): PostHog | null {
  // Do not initialize the SDK at all before the user confirms legal age.
  // Leave initialized false so confirmation can initialize it later.
  if (!getLegalAgeConfirmed()) {
    return null;
  }
  if (initialized) {
    return client;
  }
  initialized = true;
  if (typeof API_KEY !== 'string' || API_KEY.trim().length === 0) {
    return null;
  }
  client = new PostHog(API_KEY, {
    host: typeof HOST === 'string' && HOST.trim().length > 0 ? HOST : 'https://us.i.posthog.com',
    // captureAppLifecycleEvents defaults on (Application Opened/Backgrounded/…)
    errorTracking: { autocapture: { uncaughtExceptions: true, unhandledRejections: true } },
  });
  if (__DEV__) {
    client.debug();
  }
  // Anonymous device id only — no PII (a first name) leaves the device.
  client.identify(getDeviceId());
  return client;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  getClient()?.capture(event, properties as EventProperties);
}

export function trackScreen(pathname: string): void {
  getClient()?.screen(pathname);
}

export function trackError(error: unknown, properties?: Record<string, unknown>): void {
  getClient()?.captureException(error, properties as EventProperties);
}
