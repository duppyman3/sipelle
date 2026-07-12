import '@/data/install-storage';

// The import above installs a synchronous, SQLite-backed localStorage on
// native; on web the platform-split shim is empty and the browser's own
// localStorage is used. During static export routes render in Node, where no
// localStorage exists — hence the guard and the in-memory cache, which also
// serves a throwaway id for that render pass.

const STORAGE_KEY = 'sipelle.deviceId';

// Must match the server's DEVICE_ID_PATTERN so the edge functions accept it.
const DEVICE_ID_PATTERN = /^[a-z0-9-]{8,64}$/;

let cachedDeviceId: string | null = null;

function generateDeviceId(): string {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceId(): string {
  if (cachedDeviceId !== null) {
    return cachedDeviceId;
  }
  if (typeof localStorage === 'undefined') {
    cachedDeviceId = generateDeviceId();
    return cachedDeviceId;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && DEVICE_ID_PATTERN.test(stored)) {
    cachedDeviceId = stored;
    return stored;
  }
  const next = generateDeviceId();
  localStorage.setItem(STORAGE_KEY, next);
  cachedDeviceId = next;
  return next;
}
