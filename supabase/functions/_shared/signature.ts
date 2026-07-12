// HMAC over the drinks scan-menu authors, so drink-image only ever renders text
// this backend produced. The client echoes name/visualDescription back to us from
// its in-memory scan; without a signature that round-trip makes the image endpoint
// an arbitrary text-to-image proxy billed to our OpenRouter account.

let keyPromise: Promise<CryptoKey> | null = null;

/** Imports the HMAC key once per isolate. Throws when the secret is unset so callers fail closed. */
function getKey(): Promise<CryptoKey> {
  if (keyPromise === null) {
    const secret = Deno.env.get('DRINK_SIGNING_SECRET') ?? '';
    if (secret.length === 0) {
      return Promise.reject(new Error('DRINK_SIGNING_SECRET is not set'));
    }
    keyPromise = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
  }
  return keyPromise;
}

/** JSON array framing keeps the fields unambiguous — no separator can collide. */
function canonical(name: string, visualDescription: string, deviceId: string, exp: number): Uint8Array {
  return new TextEncoder().encode(JSON.stringify([name, visualDescription, deviceId, exp]));
}

/** `v1.<expiryEpochSeconds>.<hmac>` — the expiry is signed, so a caller can't extend it. */
const SIGNATURE_PATTERN = /^v1\.(\d{1,10})\.([0-9a-f]{64})$/;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Signs a normalized drink. Sign the exact strings we serialize, or verification won't match. */
export async function signDrink(
  name: string,
  visualDescription: string,
  deviceId: string,
  exp: number,
): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', await getKey(), canonical(name, visualDescription, deviceId, exp));
  return `v1.${exp}.${toHex(mac)}`;
}

/**
 * True when `sig` is our unexpired signature over this drink for this device. Binding
 * the device id and an expiry keeps harvested signatures from being replayed forever or
 * shared across rotated ids. Uses subtle.verify — constant time.
 */
export async function verifyDrink(
  name: string,
  visualDescription: string,
  deviceId: string,
  sig: string,
): Promise<boolean> {
  const match = SIGNATURE_PATTERN.exec(sig);
  if (match === null) {
    return false;
  }
  const exp = Number(match[1]);
  if (exp * 1000 <= Date.now()) {
    return false;
  }
  return await crypto.subtle.verify(
    'HMAC',
    await getKey(),
    fromHex(match[2]),
    canonical(name, visualDescription, deviceId, exp),
  );
}
