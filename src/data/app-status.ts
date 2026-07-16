// Fetches the remote kill-switch flag published at sipelle.app/status.json, so the
// app can show a maintenance notice when the backend is knowingly offline. Fails
// open: any error, timeout, or unexpected payload resolves to "not down" so a
// broken status file never blocks a healthy app.
const STATUS_URL = 'https://www.sipelle.app/status.json';

export type AppStatus = { down: true; message: string } | { down: false };

export async function fetchAppStatus(timeoutMs = 5_000): Promise<AppStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Cache-buster: iOS NSURLSession and the Cloudflare edge can otherwise serve a
    // stale "down" body after recovery, and RN fetch doesn't reliably honor
    // cache: 'no-store' on native.
    const res = await fetch(`${STATUS_URL}?t=${Date.now()}`, { signal: controller.signal });
    if (!res.ok) {
      return { down: false };
    }

    const body = (await res.json()) as unknown;
    if (typeof body !== 'object' || body === null) {
      return { down: false };
    }

    const record = body as Record<string, unknown>;
    const status = record.status;
    if (typeof status !== 'string') {
      return { down: false };
    }

    const normalized = status.trim().toLowerCase();
    if (normalized === 'offline' || normalized === 'down') {
      const message = typeof record.message === 'string' ? record.message : '';
      return { down: true, message };
    }

    return { down: false };
  } catch {
    return { down: false };
  } finally {
    clearTimeout(timeout);
  }
}
