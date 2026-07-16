# Drink-Image Cache — Design

**Date:** 2026-07-15
**Status:** Approved (design approved in-session; implementation in progress)

## Goal

Cut Sipelle's dominant AI cost — image generation — by reusing generated drink images across
users. Today every scan regenerates every drink image (~30 `gpt-5-image-mini` calls per scan,
one per drink), even when another user scanned the identical menu item minutes earlier. The
goal: when any user scans a drink whose **printed name + printed menu description** match one
already generated, serve the stored image instead of paying for a new generation — and
regenerate only when the venue actually changes its menu text.

The key wrinkle driving the design: the `visualDescription` the image model consumes today is
**AI-authored fresh on every scan** — it never matches word-for-word between scans, so it
cannot be the cache key. The scan must newly extract the *printed* description as its own field.

Decisions locked with the user (2026-07-15):
- **Cache key** = normalized printed name + normalized printed menu description (falls back to
  name alone when no description is printed).
- **Storage** = Supabase Storage public bucket in the existing Sipelle project (a later swap to
  R2 is a file copy + URL-prefix change; clients only ever see URLs).
- **Cache hits are free** — they do not consume the daily image quota.
- **Architecture** = lookup at scan time (scan-menu batch-checks every key, returns `imageUrl`
  inline for hits); drink-image keeps a race-safety cache check and performs the store after
  generating.

## Cache key

```
image_key = sha256hex(JSON.stringify([1, norm(name), norm(menuDescription ?? '')]))
```

where `norm()` = lowercase → strip all chars except letters/digits/spaces → collapse whitespace
→ trim. Punctuation is stripped because OCR punctuation is the flakiest part of extraction;
occasional near-duplicate keys from OCR variance are accepted (a rare double-generation, not a
correctness problem).

The leading `1` is a **key version** — bump it whenever the image prompt template or model
changes (`drink-image/index.ts` prompt, currently `gpt-5-image-mini` @ 1024×1024 JPEG q-low), so
old-style images regenerate instead of being served forever. Note the stored image reflects the
*first* scanner's AI-authored `visualDescription` — accepted; it is a valid rendition of the same
printed drink.

## New scan field: printed description

- `supabase/functions/_shared/menu.ts`: add `menu_description` (`['string','null']`) to
  `MENU_SCHEMA` drink items — "the drink's description exactly as printed on the menu, or null if
  none" — plus a prompt sentence telling the model to copy printed descriptions verbatim.
  Normalize (trim/clamp) into `ScannedDrink.menuDescription`.
- `supabase/functions/_shared/config.ts`: new `MAX_MENU_DESCRIPTION_CHARS = 400`.

## Database + bucket

Supabase project `cmoaqgkzotvuvkqeyhhq`, applied via the MCP migration tools.

Migration `create_drink_image_cache` (repo mirror:
`supabase/migrations/20260715000000_create_drink_image_cache.sql`):

```sql
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
```

RLS is enabled with **no policies**, so the table is reachable only via the service-role key —
identical to the `rate_limits` precedent. (The security advisor flags this as an INFO-level
`rls_enabled_no_policy`, exactly as it does for `rate_limits`; it is the intended state.)

**Scan-time batch RPC** — one round trip that both records the hit and returns the stored path:

```sql
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
```

`EXECUTE` is revoked from `public`/`anon`/`authenticated` and granted only to `service_role`,
mirroring `consume_ai_quota`. Because the `UPDATE ... RETURNING` returns a row only for keys that
already exist, the RPC doubles as the existence check: keys absent from the result are cache
misses.

**Storage:** public bucket `drink-images`, objects named `<image_key>.jpg` (~30–150 KB each; JPEG
q70 1024×1024). Public URL:
`<SUPABASE_URL>/storage/v1/object/public/drink-images/<image_key>.jpg`. Edge functions write via
the auto-injected `SUPABASE_SERVICE_ROLE_KEY` with plain `fetch` against the Storage REST API
(matching the codebase's no-supabase-js style).

## Signature: second token, no change to the existing one

The existing drink `sig` (`v1.<exp>.<hmac over JSON [name, visualDescription, deviceId, exp]>`)
stays byte-identical — old app builds keep working untouched. A **second** token binds the cache
key *to the specific drink text*, so a caller can't poison the cache — neither with an arbitrary
key nor by mix-and-matching two legitimately signed drinks from their own scans (drink B's
name/description stored under drink A's key):

- `_shared/signature.ts`: `signImageKey(imageKey, name, visualDescription, deviceId, exp)` /
  `verifyImageKey(...)` — same v1 token format, canonical
  `JSON.stringify(['imgkey', imageKey, name, visualDescription, deviceId, exp])`. The `'imgkey'`
  domain tag prevents cross-protocol confusion with drink sigs; including name +
  visualDescription means a verified `keySig` guarantees this exact prompt text belongs to this
  exact key.

## scan-menu changes

`supabase/functions/scan-menu/index.ts` + `_shared/menu.ts`. After normalization + signing:

1. Compute `imageKey` per drink.
2. One batch call to `lookup_drink_images(p_keys)` — returns the `image_path` for every key that
   already has a cached image, and atomically bumps `use_count` / `last_used_at` for those hits.
3. Response per drink gains `imageKey`, `keySig`, and — for hits — `imageUrl` (the public bucket
   URL built from `image_path`). All three fields are optional on the client, so old apps ignore
   them.

## drink-image changes

`supabase/functions/drink-image/index.ts`. The request gains optional `imageKey` + `keySig`. The
existing drink `sig` is verified first, exactly as today — the cache is only ever consulted for
requests that could already legitimately generate, so the endpoint can't become an open image
lookup.

- **`imageKey`/`keySig` present + verify** → check `drink_images` *before* `consumeQuota` (race
  safety / free hits): a hit returns `{ image: <public URL> }` without consuming quota. The
  `image` daily caps (`DAILY_CAPS`, global 1200/day) then count only real generations — the caps
  become a pure spend circuit-breaker, per the user's decision.
- **Miss** → consume quota → generate (unchanged prompt/model) → upload JPEG to bucket →
  `insert ... on conflict (image_key) do nothing` (simultaneous-generation race: first write
  wins) → return the public URL.
- **Upload or insert fails** → log, return the base64 data URI exactly as today; the cache simply
  misses again next time (graceful degradation).
- **Absent** (old app) → today's behavior verbatim: quota, generate, return base64. No cache read
  or write.
- `keySig` present but invalid → 401, same generic error as a bad drink sig.

## App changes

How images flow today: a scan eagerly enqueues every drink (`src/data/scan-session.ts:229`), a
fixed 3-wide drain loop (`scan-session.ts:45,118-135`) calls `generateDrinkImage`
(`src/ai/drink-image.ts:5-20`) per drink, and the returned data URI renders via `expo-image`
(`src/components/scanned-drink-card.tsx:150-156`). Nothing persists across app restarts; there is
a session-only name-keyed `Map` cache capped at 90 (`scan-session.ts:53-54,86-88,200-206`).

Changes:

- `src/ai/menu-scan.ts` scan types gain optional `imageUrl`, `imageKey`, `keySig` per drink (all
  optional → old/new app-server pairs never crash, matching the `totalDrinkCount` precedent).
- `src/data/scan-session.ts`: where scan results become tiles (~`:200-229`), a drink with
  `imageUrl` lands as `ready` with that URL as its image value — never enqueued. Others carry
  `imageKey`/`keySig` into the queue. The session `Map` keeps working unchanged (it now stores
  URLs as well as data URIs).
- `src/ai/drink-image.ts:10-15`: pass `imageKey`/`keySig` through in the request body when
  present. Response shape `{ image: string }` is unchanged; the value may now be an https URL —
  `expo-image` accepts any `uri` string, so `scanned-drink-card.tsx` needs no change.
- Tap-to-retry (`scan-session.ts:260-266`) is untouched — a retry just re-runs the same request,
  and may now hit the cache.

## Analytics / cost visibility

`$ai_generation` is emitted only inside `postOpenRouter` (`_shared/openrouter.ts:52-91`), so cache
hits emit nothing and LLM Analytics spend stays accurate automatically — expect event *volume* to
drop as the hit rate grows; that's the feature working. Hit statistics come from
`drink_images.use_count` / `last_used_at`. No new PostHog events (per the repo's curated-events
rule; a `drink_image_cache_hit` event can be added later if dashboard visibility is wanted).

## Version-skew matrix

| App | Backend | Result |
|---|---|---|
| old | new | Works, uncached: scan response's extra fields ignored; drink-image without `imageKey` = today's path |
| new | old (deploy window) | Works: scan returns no `imageKey`, app calls drink-image without cache fields |
| new | new | Full caching |

Redeploy reminder: both functions must go out with `verify_jwt: false` (the MCP deploy tool
defaults it back to `true`, which 401s the app).

## Verification

1. `npx tsc --noEmit`, `npx expo lint`, `npx expo export --platform android` smoke test.
2. Deploy functions; scan a real menu photo twice (two different device ids if possible):
   - First scan: images generate; `drink_images` rows appear and `storage.objects` has matching
     `<image_key>.jpg` entries (check via MCP SQL); response URLs load in a browser.
   - Second scan: scan response carries `imageUrl` for every previously seen drink; PostHog shows
     **no** new `$ai_generation` image events; `use_count` incremented.
3. Old-client simulation: `curl` drink-image with only name/visualDescription/deviceId/sig (no
   imageKey) → still generates and returns base64.
4. Quota check: cache hits leave the image quota rows untouched (`rate_limits` via MCP SQL).

## Deferred / out of scope

- R2 migration (revisit if egress approaches plan limits), image eviction/refresh policy, admin
  tooling, on-device image persistence.
