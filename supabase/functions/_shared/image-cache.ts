// Server-side image cache: derive a stable key from a drink's printed text, look up
// and store generated images in the public `drink-images` bucket, and read hits back
// through the drink_images table. All access uses the auto-injected service-role key
// with plain fetch against the PostgREST and Storage REST APIs — matching the
// codebase's no-supabase-js style (see rate-limit.ts).

/**
 * The cache-key version. Bump it whenever the image prompt template or model changes
 * (drink-image/index.ts), so images made under an old prompt regenerate instead of
 * being served forever.
 */
export const IMAGE_KEY_VERSION = 1;

const BUCKET = 'drink-images';

/** Punctuation is stripped because OCR punctuation is the flakiest part of extraction. */
function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** sha256hex over [version, normalized name, normalized printed description]. */
export async function computeImageKey(name: string, menuDescription: string | null): Promise<string> {
  const payload = JSON.stringify([IMAGE_KEY_VERSION, norm(name), menuDescription ? norm(menuDescription) : '']);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return toHex(digest);
}

function supabaseUrl(): string {
  return Deno.env.get('SUPABASE_URL') ?? '';
}

// Modern secret keys live in SUPABASE_SECRET_KEYS['default']; fall back to the legacy
// service-role JWT (auto-injected). Both bypass RLS.
function serviceKey(): string {
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  return secretKeys['default'] ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

// PostgREST/RPC auth, mirroring rate-limit.ts: an sb_secret_ key goes in the apikey
// header only; a legacy JWT additionally needs an Authorization: Bearer header.
function restHeaders(extra: Record<string, string>): Record<string, string> {
  const secret = serviceKey();
  const headers: Record<string, string> = { apikey: secret, ...extra };
  if (!secret.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${secret}`;
  }
  return headers;
}

// Storage authorizes on the Authorization: Bearer service-role key — public=true grants
// only read, so writes need it. Send it in both headers so whichever the API reads finds
// the key; the new secret keys are valid bearer tokens too.
function storageHeaders(extra: Record<string, string>): Record<string, string> {
  const secret = serviceKey();
  return { apikey: secret, Authorization: `Bearer ${secret}`, ...extra };
}

/** The public https URL for a stored object path (`<image_key>.jpg`). */
export function publicImageUrl(imagePath: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/${BUCKET}/${imagePath}`;
}

/**
 * Maps each hit image_key to its stored image_path. Calls the lookup_drink_images RPC,
 * which also bumps use_count/last_used_at for the matched rows. Throws on RPC failure so
 * callers can decide to degrade (scan-menu) rather than fail.
 */
export async function lookupDrinkImages(keys: string[]): Promise<Map<string, string>> {
  if (keys.length === 0) {
    return new Map();
  }
  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/lookup_drink_images`, {
    method: 'POST',
    headers: restHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ p_keys: keys }),
  });
  if (!res.ok) {
    throw new Error(`drink image lookup RPC failed (${res.status})`);
  }
  const rows = (await res.json()) as { image_key: string; image_path: string }[];
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.image_key, row.image_path);
  }
  return map;
}

/** Metadata stored alongside the object; the image_key remains the authoritative cache key. */
export type DrinkImageRow = { name: string; visualDescription: string; menuDescription?: string | null };

/**
 * Uploads the JPEG to the bucket then records its row. The insert ignores duplicates so a
 * simultaneous-generation race resolves first-write-wins. Throws on any failure so the
 * caller can fall back to returning the image inline.
 */
export async function storeDrinkImage(imageKey: string, jpegBytes: Uint8Array, row: DrinkImageRow): Promise<void> {
  const imagePath = `${imageKey}.jpg`;
  const upload = await fetch(`${supabaseUrl()}/storage/v1/object/${BUCKET}/${imagePath}`, {
    method: 'POST',
    headers: storageHeaders({ 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }),
    body: jpegBytes,
  });
  if (!upload.ok) {
    throw new Error(`drink image upload failed (${upload.status})`);
  }
  const insert = await fetch(`${supabaseUrl()}/rest/v1/drink_images?on_conflict=image_key`, {
    method: 'POST',
    headers: restHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' }),
    body: JSON.stringify({
      image_key: imageKey,
      name: row.name,
      menu_description: row.menuDescription ?? null,
      visual_description: row.visualDescription,
      image_path: imagePath,
    }),
  });
  if (!insert.ok) {
    throw new Error(`drink image insert failed (${insert.status})`);
  }
}
