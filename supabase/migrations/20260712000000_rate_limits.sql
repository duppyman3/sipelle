-- Per-device / per-IP daily counters for AI edge functions. Day boundaries are UTC.
create table public.rate_limits (
  day   date    not null,
  scope text    not null check (scope in ('device', 'ip')),
  key   text    not null,
  kind  text    not null check (kind in ('scan', 'image')),
  count integer not null default 0,
  primary key (day, scope, key, kind)
);
alter table public.rate_limits enable row level security;  -- no policies: service-role only

create or replace function public.consume_ai_quota(
  p_device_key text, p_ip_key text, p_kind text,
  p_device_limit integer, p_ip_limit integer
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_device_count integer;
  v_ip_count integer;
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

  return jsonb_build_object(
    'allowed', v_device_count <= p_device_limit and v_ip_count <= p_ip_limit,
    'device_count', v_device_count, 'ip_count', v_ip_count);
end;
$$;

revoke execute on function public.consume_ai_quota(text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_ai_quota(text, text, text, integer, integer)
  to service_role;
