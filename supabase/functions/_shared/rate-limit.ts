import { DAILY_CAPS, type Kind } from '../_shared/config.ts';

/** Best-effort client IP: Cloudflare's header first, then the X-Forwarded-For chain. */
export function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) {
    return cf;
  }
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

type QuotaResult = { allowed: boolean; device_count: number; ip_count: number };

/**
 * Atomically increments the per-device and per-IP counters for `kind` and reports
 * whether the request is within today's caps. Calls the consume_ai_quota RPC with
 * the service-role key so it bypasses RLS. Throws on any RPC failure so the caller
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
    }),
  });
  if (!res.ok) {
    throw new Error(`quota RPC failed (${res.status})`);
  }
  return res.json() as Promise<QuotaResult>;
}
