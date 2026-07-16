-- Shared server-side cache of generated drink images, keyed by normalized printed
-- name + printed menu description (see docs/superpowers/specs/2026-07-15-drink-image-cache-design.md).
-- Any user scanning a drink whose key already exists is served the stored image for free
-- (no image-quota consumption), instead of paying for a fresh gpt-5-image-mini generation.
create table public.drink_images (
  image_key          text        primary key,
  name               text        not null,
  menu_description   text,
  visual_description text        not null,
  image_path         text        not null,      -- object path in the drink-images bucket
  created_at         timestamptz not null default now(),
  last_used_at       timestamptz not null default now(),
  use_count          integer     not null default 0
);
alter table public.drink_images enable row level security;  -- no policies: service-role only

-- Scan-time batch lookup that also bumps hit counters in the same round trip. Returns one
-- row per key that already has a cached image; the UPDATE ... RETURNING both records the hit
-- (use_count, last_used_at) and yields the stored image_path for the scan response.
create or replace function public.lookup_drink_images(p_keys text[])
  returns table(image_key text, image_path text)
  language sql security definer set search_path = ''
as $$
  update public.drink_images d
     set use_count = d.use_count + 1,
         last_used_at = now()
   where d.image_key = any(p_keys)
  returning d.image_key, d.image_path;
$$;

revoke execute on function public.lookup_drink_images(text[])
  from public, anon, authenticated;
grant execute on function public.lookup_drink_images(text[])
  to service_role;

-- Public bucket holding the generated <image_key>.jpg objects. Public so the app can render
-- the images by URL with no auth; the edge functions write via the service-role key.
insert into storage.buckets (id, name, public)
values ('drink-images', 'drink-images', true)
on conflict (id) do nothing;
