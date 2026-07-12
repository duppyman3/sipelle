import { DAILY_CAPS, type Kind } from '../_shared/config.ts';

/**
 * The client IP, or null when we can't establish one. Only cf-connecting-ip is
 * trusted: Cloudflare overwrites it on ingress, whereas X-Forwarded-For is
 * client-supplied and spoofable. Callers must fail closed when this returns null —
 * bucketing unidentified callers together would hand them a shared free quota.
 */
export function clientIp(req: Request): string | null {
  return req.headers.get('cf-connecting-ip');
}

type QuotaResult = { allowed: boolean; device_count: number; ip_count: number; global_count: number };

/**
 * Atomically increments the per-device, per-IP, and global counters for `kind` and
 * reports whether the request is within today's caps. Calls the consume_ai_quota RPC
 * with the service-role key so it bypasses RLS. Throws on any RPC failure so the caller
 * fails closed (returns 500) rather than letting usage go uncounted.
 */
export async function consumeQuota(args: { deviceId: string; ip: string; kind: Kind }): Promise<QuotaResult> {
  const { deviceId, ip, kind } = args;

  // Modern secret keys live in SUPABASE_SECRET_KEYS['default']; fall back to the
  // legacy service-role JWT. An sb_secret_ key goes in the apikey header only; the
  // legacy JWT additionally needs an Authorization: Bearer header.
  const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
  const secret = secretKeys['default'] ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: secret,
  };
  if (!secret.startsWith('sb_secret_')) {
    headers.Authorization = `Bearer ${secret}`;
  }

  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/consume_ai_quota`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_device_key: deviceId,
      p_ip_key: ip,
      p_kind: kind,
      p_device_limit: DAILY_CAPS.device[kind],
      p_ip_limit: DAILY_CAPS.ip[kind],
      p_global_limit: DAILY_CAPS.global[kind],
    }),
  });
  if (!res.ok) {
    throw new Error(`quota RPC failed (${res.status})`);
  }
  return res.json() as Promise<QuotaResult>;
}
