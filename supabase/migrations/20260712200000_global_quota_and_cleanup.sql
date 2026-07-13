-- Global daily spend circuit breaker (SECURITY_AUDIT.md Finding #1) + rate_limits TTL (Finding #6).
--
-- DEPLOY ORDER HAZARD: this drops the 5-arg consume_ai_quota that the CURRENTLY DEPLOYED edge
-- functions call. Applying this migration BEFORE redeploying scan-menu and drink-image will make
-- every live scan/image request fail. Deploy the new edge functions immediately after (or before)
-- applying this, and expect a brief window of 500s in between.

-- 1. Allow a third counter scope for the account-wide ceiling.
alter table public.rate_limits drop constraint rate_limits_scope_check;
alter table public.rate_limits add constraint rate_limits_scope_check
  check (scope in ('device', 'ip', 'global'));

-- 2. Replace the 5-arg quota RPC with a 6-arg version that also increments and enforces a
--    single ('global','all',kind) counter, so total daily spend is bounded no matter how many
--    deviceIds or IPs an attacker rotates through.
drop function if exists public.consume_ai_quota(text, text, text, integer, integer);

create or replace function public.consume_ai_quota(
  p_device_key text, p_ip_key text, p_kind text,
  p_device_limit integer, p_ip_limit integer, p_global_limit integer
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_device_count integer;
  v_ip_count integer;
  v_global_count integer;
begin
  if p_kind not in ('scan', 'image') then
    raise exception 'invalid kind: %', p_kind;
  end if;
  -- Increment-then-check (attempts count even when rejected); fixed order avoids deadlocks.
  insert into public.rate_limits as r (day, scope, key, kind, count)
  values (v_day, 'device', p_device_key, p_kind, 1)
  on conflict (day, scope, key, kind) do update set count = r.count + 1
  returning r.count into v_device_count;

  insert into public.rate_limits as r (day, scope, key, kind, count)
  values (v_day, 'ip', p_ip_key, p_kind, 1)
  on conflict (day, scope, key, kind) do update set count = r.count + 1
  returning r.count into v_ip_count;

  insert into public.rate_limits as r (day, scope, key, kind, count)
  values (v_day, 'global', 'all', p_kind, 1)
  on conflict (day, scope, key, kind) do update set count = r.count + 1
  returning r.count into v_global_count;

  return jsonb_build_object(
    'allowed', v_device_count <= p_device_limit
           and v_ip_count <= p_ip_limit
           and v_global_count <= p_global_limit,
    'device_count', v_device_count,
    'ip_count', v_ip_count,
    'global_count', v_global_count);
end;
$$;

revoke execute on function public.consume_ai_quota(text, text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_ai_quota(text, text, text, integer, integer, integer)
  to service_role;

-- 3. TTL: rate_limits rows are keyed by an attacker-rotatable deviceId, so they accumulate
--    forever. Keep 7 days and drop the rest, once a day at 03:17 UTC.
create extension if not exists pg_cron;

-- cron.schedule upserts by job name, so re-running this migration is safe.
select cron.schedule(
  'sipelle-rate-limits-cleanup',
  '17 3 * * *',
  $$delete from public.rate_limits where day < (now() at time zone 'utc')::date - 7$$
);
