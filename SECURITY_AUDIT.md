# Sipelle — Security Audit (Re-Audit)

**Date:** 2026-07-12 (re-audit; supersedes the first pass earlier the same day)
**Scope:** Expo SDK 57 React Native app (`src/`) + Supabase Edge Functions (`supabase/functions/`) + the live Supabase project `cmoaqgkzotvuvkqeyhhq`.
**Method:** Full source read of the working tree + **live** database and edge-function queries via the Supabase MCP tools + `npm audit` + git-history checks. Four independent auditors covered Sections 1/5, 2, 3/4, and 6/7/8; all findings below were verified against current code, not carried over on trust.

> **Architecture note.** This is a native mobile app, not a Next.js web app. It has **no end-user authentication by design** — identity is an anonymous, client-generated `deviceId`. There is no login, session, password, OAuth, web middleware, or Supabase Storage. Several checklist items are legitimately N/A; each still receives an explicit verdict. `EXPO_PUBLIC_*` values are inlined into the shipped bundle by design — the question for each is not "is it public?" but "is it *safe* to be public?"

> **⚠️ Working tree vs production.** The repo contains uncommitted remediation work: a new HMAC signature scheme (`supabase/functions/_shared/signature.ts`) that makes `drink-image` render only drinks that `scan-menu` itself authored. **This code is NOT deployed.** Both functions in production are still `version 2`, which predates it. Every verdict below is therefore given twice where it matters: **working tree** vs **live production**.

---

## 1. Security Posture Rating

### Working tree: 🟡 ACCEPTABLE — Live production: 🟠 NEEDS WORK

**Executive summary.** The confidentiality story remains genuinely strong and is unchanged: no hardcoded secrets, no secret ever committed to git history, no exposed tables, no user data at risk, and a textbook-hardened database RPC. Nothing here leaks user data, because there is essentially no user data to leak.

The risk is, as before, **cost and revenue — not confidentiality**. Two things changed since the first pass, one good and one alarming.

The good: the new HMAC scheme is **well-engineered** — sound canonicalization, constant-time verification, fails closed, and verified *before* quota consumption so a forged request costs nothing. Deploying it is a real improvement.

The alarming: **it is not deployed.** Production is still running the pre-signature version, which means the original Finding #2 — `drink-image` as an open, arbitrary text-to-image proxy billed to the developer's OpenRouter account — **is live right now**, exactly as it was at the first audit. The fix exists only in an uncommitted working tree, where it protects nothing.

And even once deployed, the signature scheme **does not fix the cost problem**. It raises the per-IP image ceiling by *zero*. An attacker simply harvests signatures first — one scan yields up to 30 signed drinks, and signatures carry no expiry, no nonce, and no device binding, so they are eternal and infinitely replayable. Every load-bearing cost control from the first audit (X-Forwarded-For trust, forgeable `deviceId`, no global spend cap, no OpenRouter account cap) is **untouched**. The premium stub also still has no ship guard.

**Bottom line:** deploy the signature work (it's ready and strictly better than what's live), but do not mistake it for the cost fix. The spend ceiling is still bounded only by per-IP caps that collapse under IP rotation.

---

## 2. Critical and High Findings

### FINDING #2 (REOPENED) — `drink-image` is an open text-to-image proxy **in production right now**

| | |
|---|---|
| **Severity** | **HIGH** (production) / **MEDIUM** (working tree, residual) |
| **Category** | Prompt Injection / Abuse of Functionality |
| **Location** | Deployed `drink-image` v2; fix sits unshipped in `supabase/functions/_shared/signature.ts` |
| **CWE** | CWE-1427 (Improper Neutralization of Input Used for LLM Prompting) |
| **Status** | **OPEN in production** · **PARTIALLY FIXED in the working tree** |

**What's wrong.** The deployed `drink-image` accepts `{deviceId, name, visualDescription}`, validates them for shape and length only, and concatenates them straight into an image-generation prompt. There is no `sig` field and no signature check in the deployed bundle — verified live via `get_edge_function`. Anyone holding the publishable key (which ships in the app bundle and is extractable in minutes) can POST arbitrary text and receive a generated image billed to the developer's OpenRouter account, with `HTTP-Referer: https://www.sipelle.app` attached. That is both a cost sink and a **content-liability risk**: attacker-authored imagery produced under the developer's account.

**What the working tree fixes — and doesn't.** Once deployed, `verifyDrink()` closes the *direct* injection path completely: only the exact bytes `scan-menu` signed will verify, so appended instructions change the canonical input and fail. The **residual** path is a fake menu: an attacker composes a menu image, POSTs it to `scan-menu`, and the vision model extracts names and authors `visual_description`s — which the backend then signs. Those signatures replay freely to `drink-image`. Control is materially reduced (the *model* authors the description, the prompt hard-frames "Professional beverage photograph of…", the name is capped at 120 chars), so it is no longer a general-purpose image generator — but it is not fully neutralized. HIGH → MEDIUM.

**The fix.**
1. **Set the `DRINK_SIGNING_SECRET` function secret first** (both new functions hard-fail 500 without it).
2. **Deploy `scan-menu` no later than `drink-image`** — otherwise real scans return no signatures and every image call 401s.
3. **Re-pass `verify_jwt: false`** on both redeploys (the MCP tool defaults it back to `true`, which 401s the app — per `CLAUDE.md`).

**Effort:** ~15 minutes to deploy what already exists.

---

### FINDING #1 — Cost abuse: rate limiting is bypassable and there is no spend ceiling

| | |
|---|---|
| **Severity** | **HIGH** |
| **Category** | Improper Access Control / Uncontrolled Resource Consumption |
| **Location** | `supabase/functions/_shared/rate-limit.ts:4-14`, `_shared/config.ts:7-10`, `supabase/migrations/20260712000000_rate_limits.sql:4` |
| **CWE** | CWE-770, CWE-807 |
| **Status** | **STILL OPEN** — unchanged in both the working tree and production |

**What's wrong.** Three compounding gaps, none addressed by the signature work:

1. **`deviceId` is forgeable.** It comes from the request body, validated for *shape* (`/^[a-z0-9-]{8,64}$/`) but not authenticity. A fresh id per request means the per-device caps (20 scans / 600 images per day) never bind. The HMAC signs `[name, visualDescription]` only — it does **not** bind `deviceId`, so this is untouched.
2. **`clientIp()` still trusts `X-Forwarded-For`** and falls back to a shared `'unknown'` bucket — byte-identical to the code flagged in the first audit.
3. **No global circuit breaker.** The `rate_limits.scope` CHECK constraint still permits only `('device','ip')` — verified live — so a total-spend ceiling cannot even be recorded, let alone enforced.

**Why the signature scheme doesn't help.** Signatures have **no expiry, no nonce, and no device binding** — they are permanent and replayable from any device. One scan yields up to 30 signed drinks; 60 scans (the honest per-IP daily cap) yields ~1,800 — exactly enough to saturate the 1,800-image per-IP cap. Or the attacker just replays yesterday's signatures and skips scanning entirely.

**Worst-case cost math:**

| | Live production (v2, unsigned) | Working tree (HMAC deployed) |
|---|---|---|
| Paid images/day/honest IP | **1,800** | **1,800** (unchanged) |
| Prompt content | **Arbitrary** (open proxy) | Model-authored, drink-framed |
| Effect of IP rotation | Linear, **no ceiling** | Linear, **no ceiling** |

So the HMAC gate is a **content-liability win, not a cost win**.

**The fix**, in order of value:

1. **Set a hard spend cap on the OpenRouter account itself** (~5 min, dashboard). This is the only control that survives every application-layer bug, and it is the single highest-value action in this entire report. Do it today, before anything else.
2. **Stop trusting `X-Forwarded-For`** (~10 min) — honour only the header the platform sets, and fail closed rather than bucketing unknown callers together:
```ts
export function clientIp(req: Request): string | null {
  // Cloudflare overwrites this on ingress; anything else is client-supplied.
  return req.headers.get('cf-connecting-ip');
}
```
then reject when absent: `if (!ip) return json(400, { error: 'Invalid request.' });`
3. **Add a global daily circuit breaker** (~30 min) so total spend is bounded regardless of how many devices or IPs an attacker rotates through:
```sql
alter table public.rate_limits drop constraint rate_limits_scope_check;
alter table public.rate_limits add constraint rate_limits_scope_check
  check (scope in ('device', 'ip', 'global'));
```
and increment a `('global','all')` counter inside `consume_ai_quota`, denying past a daily budget you are willing to pay for.

**Effort:** ~45 minutes total.

---

### FINDING #3 — Premium entitlement is client-trusted, and the ship guard was never added

| | |
|---|---|
| **Severity** | **HIGH** (if shipped) |
| **Category** | Business Logic / Revenue Integrity |
| **Location** | `src/data/premium.ts:68-72` |
| **CWE** | CWE-602 (Client-Side Enforcement of Server-Side Security) |
| **Status** | **STILL OPEN** — file unchanged; the recommended `__DEV__` guard is **not present** |

`purchasePremium()` performs no purchase: it waits 1.2 seconds and writes `sipelle.premium = 'true'` to local storage, and entitlement is read back from that same client-writable flag. The paywall grants lifetime premium to **every** user for **$0** — a 100% revenue leak. The team clearly knows (the file is marked "must NOT ship"), so this is a **release-gate item**, not a latent bug. But the first audit recommended a build guard so it *cannot* ship by accident, and that guard was never added.

**The fix** (~5 min) — make the production build fail loudly:
```ts
if (!__DEV__) {
  throw new Error('premium.ts dev stub must be replaced with RevenueCat before release');
}
```
Then complete the planned Phase-2 RevenueCat swap and validate entitlement against `CustomerInfo` rather than a local flag.

---

## 3. Quick Wins

Each under ~10 minutes, in the order I'd do them:

1. **Set the OpenRouter account spend cap** (~5 min) — highest value in the report; protects you *right now*, while the open proxy is live.
2. **Deploy the signature work** (~15 min) — the fix is written and sitting idle while the hole it closes is live.
3. **Add the `premium.ts` production build guard** (~5 min) — makes the revenue leak impossible to ship silently.
4. **Fix `.gitignore` `.env` coverage** (~2 min) — Finding #4.
5. **Reject requests with no `cf-connecting-ip`** (~10 min) — removes the XFF spoofing path and the shared `'unknown'` bucket.
6. **Suppress upstream error passthrough** (~10 min) — Finding #5.
7. **Add a `Content-Length` guard to `drink-image`** (~5 min) — Finding #9.

---

## 4. Prioritized Remediation Plan

| # | Action | Finding | Severity | Effort |
|---|---|---|---|---|
| 1 | Set OpenRouter account spend cap | #1 | HIGH | ~5 min |
| 2 | Set `DRINK_SIGNING_SECRET`, deploy both functions (`verify_jwt:false`) | #2 | HIGH | ~15 min |
| 3 | Add `premium.ts` production build guard | #3 | HIGH | ~5 min |
| 4 | Fix `.gitignore` `.env` coverage | #4 | MEDIUM | ~2 min |
| 5 | Stop trusting `X-Forwarded-For` in `clientIp()` | #1 | HIGH | ~10 min |
| 6 | Suppress upstream error passthrough | #5 | MEDIUM | ~10 min |
| 7 | Add `Content-Length` guard to `drink-image` | #9 | LOW | ~5 min |
| 8 | Add global daily spend circuit breaker | #1 | HIGH | ~30 min |
| 9 | Add `rate_limits` cleanup/TTL job | #6 | LOW | ~20 min |
| 10 | Bind `deviceId` + a TTL into the drink signature | #10 | MEDIUM | ~30 min |
| 11 | Drop `first_name` from PostHog `identify()` / add disclosure | #7 | MEDIUM | ~5 min / ~1 hr |
| 12 | Complete RevenueCat swap | #3 | HIGH | Phase 2 |
| 13 | Server-side caching of `visualDescription` | #2 | MEDIUM | ~2 hrs |

**Suggested first session (~1.5 hrs):** items 1–8. That closes the live open-proxy hole, caps spend three ways, and prevents the revenue leak from shipping.

---

## 5. Remaining Findings

### FINDING #4 — `.gitignore` does not cover a plain `.env`
**MEDIUM** · Secret Management · `.gitignore:34` · CWE-540 · **STILL OPEN**

Only `.env*.local` is ignored. A file named `.env`, `.env.production`, or `supabase/functions/.env` **would be committed**. History is verified clean (`git log --all --diff-filter=A -- "*.env*"` is empty) and `.env.local` is correctly untracked — so this is a latent footgun, not an active exposure. But it is exactly the mistake that leaks an OpenRouter or `DRINK_SIGNING_SECRET` key, and the fix is three lines:
```gitignore
.env
.env.*
!.env.example
```
**Effort:** ~2 minutes.

---

### FINDING #5 — Upstream OpenRouter error messages are relayed to clients
**MEDIUM** · Information Disclosure · `scan-menu/index.ts:74`, `drink-image/index.ts:85` (source: `_shared/openrouter.ts:55-64`) · CWE-209 · **STILL OPEN**

Both functions return OpenRouter's raw `error.message` verbatim as `json(…, { error: err.message })`. Upstream provider errors routinely disclose model identifiers, provider routing, and quota/billing state ("insufficient credits"). This hands an attacker a free oracle for probing the AI configuration and account status — and it pairs badly with Finding #1, telling an attacker exactly when their cost abuse is biting.

**The fix** — log server-side, return generic:
```ts
console.error('openrouter upstream failure', { status: err.status, message: err.message });
return json(err.status === 0 ? 504 : 502, { error: 'The menu could not be read. Try a clearer photo.' });
```
**Effort:** ~10 minutes.

---

### FINDING #6 — `rate_limits` table grows without bound
**LOW** · Resource Consumption · `supabase/migrations/20260712000000_rate_limits.sql:2-9` · **STILL OPEN**

Because `deviceId` is attacker-controlled, every rotated id inserts a new permanent row and nothing ever deletes old ones. Fix with a `pg_cron` job:
```sql
delete from public.rate_limits where day < (now() at time zone 'utc')::date - 7;
```
**Effort:** ~20 minutes.

---

### FINDING #7 — First name and error stack traces sent to PostHog without disclosure
**MEDIUM** (privacy/compliance, not exploitable) · `src/analytics/posthog.ts:30-39` · CWE-359 · **STILL OPEN**

`client.identify(getDeviceId(), { first_name: firstName })` sends **PII** to PostHog US Cloud tied to a persistent device identifier, and `errorTracking.autocapture` ships stack traces (which in this app can carry menu-scan content) to a third party. There is no consent prompt, disclosure, or opt-out. Apple requires an accurate Privacy Nutrition Label for exactly this ("Contact Info → Name", "Identifiers", "Diagnostics"); GDPR/CCPA require disclosure.

**The fix:** drop `first_name` and rely on the anonymous `deviceId` (~5 min — the analytics value of a first name is near zero), or keep it and add a disclosure + opt-out (~1 hr). Either way, make the store privacy label match what is actually sent.

---

### FINDING #8 (WITHDRAWN) — "Unused dependencies" — the first audit was **wrong**

The previous audit told you to run `npm uninstall expo-file-system expo-device expo-application expo-constants`. **Do not do this.** Three of those four are **optional peer dependencies of `posthog-react-native`** and are required at runtime by its optional integrations — verified in `node_modules/posthog-react-native/package.json` (`peerDependenciesMeta`) and in its `dist/optional/OptionalExpoDevice.js`, `OptionalExpoFileSystem.js`, and `native-deps.js`, which `require()` them directly for device/app context enrichment and file-based persistence.

| Package | Verdict |
|---|---|
| `expo-application` | **KEEP** — PostHog optional integration |
| `expo-device` | **KEEP** — PostHog optional integration |
| `expo-file-system` | **KEEP** — PostHog device context + persistence |
| `expo-constants` | No direct consumer, but it's a transitive dep of expo core/router anyway — removing the direct entry reduces nothing. Leave it. |

Executing the old recommendation would have silently degraded analytics. **This finding is withdrawn; no action.**

---

### FINDING #9 (NEW) — `drink-image` has no `Content-Length` guard
**LOW** · Resource Consumption · missing before `supabase/functions/drink-image/index.ts:33`

`scan-menu` rejects oversized bodies *before* reading them (`scan-menu/index.ts:28-31`), but `drink-image` calls `req.json()` and buffers the entire body before its length caps apply. A caller with the extractable publishable key can POST an arbitrarily large body. No cost impact (the signature and quota gates sit downstream), so this is a memory nuisance, not a bill. Mirror the `scan-menu` guard with a ~10 KB limit. **Effort:** ~5 minutes.

---

### FINDING #10 (NEW) — Drink signatures never expire and aren't bound to a device
**MEDIUM** · `supabase/functions/_shared/signature.ts:27-28,48-51`

The HMAC covers `[name, visualDescription]` and nothing else — **no nonce, no timestamp, no `deviceId`**. A signature is therefore valid forever, transferable between devices, and infinitely replayable. One scan yields up to 30 permanent image tokens. This is acceptable *only* if rate limiting is the real control — and Finding #1 means it isn't yet.

**The fix:** bind `deviceId` into `canonical()` and add a signed expiry (e.g. a 24-hour TTL), so harvested signatures decay and can't be shared across rotated device ids. **Effort:** ~30 minutes.

---

## 6. What's Already Done Right

These are load-bearing. **Do not regress them.**

- **The OpenRouter key never touches the client.** It exists only as a Supabase function secret read via `Deno.env` (`_shared/openrouter.ts:31`). The new `DRINK_SIGNING_SECRET` follows the same correct pattern. This is the single most important thing this codebase gets right.
- **No hardcoded secrets anywhere.** A full-tree scan for `sk-`, `eyJ`, `AKIA`, `ghp_`, `phc_`, Bearer literals and long quoted strings found **zero** real secrets — only env-var reads and lockfile integrity hashes.
- **No secret has ever been committed to git history.** Verified: `git log --all --diff-filter=A -- "*.env*"` is empty. `.env.local` is untracked and ignored; neither of its live secrets appears in any tracked file.
- **Zero `console.*` calls in `src/`** — no path for env vars or tokens to leak to a device log.
- **The `consume_ai_quota` RPC is textbook-hardened** — `SECURITY DEFINER` with `search_path = ''` pinned, fully parameterized, `EXECUTE` revoked from `public`/`anon`/`authenticated` and granted only to `service_role`. Re-confirmed live against the database ACL.
- **RLS is enabled on the only public table** (`rate_limits`), with zero policies — a deliberate deny-all for a service-role-only table. Re-confirmed live. The `rls_auto_enable` event trigger auto-enables RLS on any future public table, which is a genuinely good guard.
- **`verify_jwt: false` is still correctly set** on both deployed functions — no regression to `true`.
- **The new HMAC scheme is well-engineered.** Canonicalization via `JSON.stringify([name, desc])` is injective (no separator collision); verification uses `crypto.subtle.verify` (constant-time, not recompute-and-compare); it fails closed when the secret is unset; the rejected-key-promise edge case is unreachable because the promise is never cached on rejection; and verification runs **before** quota consumption, so a forged request costs neither a DB write nor another user's quota. The trim/slice normalization in `menu.ts` correctly signs the exact strings the client echoes back, so no legitimate drink fails verification. It deserves to be deployed.
- **Rate limiting is server-side, durable, and fails closed** — Postgres-backed (survives redeploys), and an RPC error returns 500 rather than letting the request through.
- **Both Edge Functions are default-deny.** The `apikey` check runs *before* any body parsing or upstream work; non-POST methods are rejected with 405.
- **Input is validated server-side** — `deviceId` regex, length bounds, a `Content-Length` guard on `scan-menu`, and strict JSON-schema-constrained model output re-normalized server-side.
- **The menu-scan prompt and schema are kept server-side** so they can't be lifted from the app bundle.
- **No user data is at risk.** No credentials, no direct table access, no storage uploads, no account data. Scan session state is purely in-memory — not even persisted. There is no auth to bypass and no PII store to breach.

---

## 7. Checklist Summary

**Section 1 — Secrets:** 1.1 ✅ 1.2 ⚠️ 1.3 ✅ 1.4 ✅ 1.5 ✅ 1.6 ✅
**Section 2 — Database:** 2.1 ✅ 2.2 ✅ 2.3 ⬚ 2.4 ⬚ 2.5 ✅ 2.6 ⬚ 2.7 ✅ 2.8 ✅
**Section 3 — Auth:** 3.1 ✅ 3.2 ✅ 3.3 ⬚ 3.4 ⬚ 3.5 ✅ 3.6 ✅ 3.7 ⬚ 3.8 ⬚
**Section 4 — Validation:** 4.1 ⚠️ 4.2 ❌ 4.3 ✅ 4.4 ✅ 4.5 ❌ 4.6 ⚠️
**Section 5 — Dependencies:** 5.1 ⚠️ 5.2 ✅ 5.3 ✅ 5.4 ⚠️ 5.5 ✅
**Section 6 — Rate Limiting:** 6.1 ❌ 6.2 ⬚ 6.3 ⚠️
**Section 7 — CORS:** 7.1 ✅ 7.2 ✅
**Section 8 — File Upload:** 8.1 ⚠️ 8.2 ⬚ 8.3 ⬚

### Verdict notes

- **1.2 ⚠️** — history verified clean, but `.gitignore` still wouldn't catch a plain `.env` (Finding #4).
- **1.3 ✅** — all four `EXPO_PUBLIC_*` values (Supabase URL, publishable key, PostHog key + host) are safe-to-be-public. Grep of `src/` for `OPENROUTER_API_KEY`, `DRINK_SIGNING_SECRET`, `service_role` returns **zero**.
- **1.6 ✅** — `hasAiBackend()` gates AI features client-side; both functions check `OPENROUTER_API_KEY` **and** `DRINK_SIGNING_SECRET` and 500 if absent. Minor cosmetic wart: in `scan-menu` the env check sits *after* `consumeQuota`, so a misconfigured deploy burns a quota unit before returning 500. `drink-image` orders it correctly.
- **2.x** — re-verified **live**. `rate_limits` is still the only public table, RLS on, zero policies. Two `SECURITY DEFINER` functions, both accounted for; the advisor's WARN on `rls_auto_enable` remains a **false positive** (it returns `event_trigger`, which PostgREST cannot invoke). Nothing new appeared.
- **3.3 ⬚** — no supabase-js auth, so `getUser()` vs `getSession()` doesn't apply. Stated plainly: **the publishable-key check is not authentication.** The key ships in the bundle and is extractable. It stops drive-by scanning; it does not stop a motivated attacker. All real protection must come from rate limits, spend caps, and the drink signature — which is why Finding #1 is the headline.
- **4.2 ❌** — identity (`deviceId`) still comes from the request body. The HMAC does **not** bind it (Findings #1, #10).
- **4.3 ✅** — upgraded from N/A: React Native has no DOM sink, and the image `media_type` comes from the trusted OpenRouter response, not the client.
- **4.5 ❌** — upstream error passthrough (Finding #5).
- **4.6 ⚠️** — no external webhooks, but the **internal** signature scheme was reviewed adversarially. Cryptographically sound; the gaps are policy, not crypto (no expiry/nonce/device binding — Finding #10; fake-menu signature harvesting — Finding #2 residual).
- **5.1 / 5.4 ⚠️** — `npm audit`: **11 moderate, 0 high/critical**, all from one advisory (`uuid` GHSA-w5hq-g745-h8pq) reached via `expo-splash-screen → @expo/config-plugins → xcode → uuid@7`. **Build-time tooling only; none ships in the app bundle.** `npm audit fix --force` would downgrade Expo and break the build. Correct action: **accept and monitor** for an upstream bump.
- **5.5 ✅** — corrected from ❌. The previous "unused dependencies" finding was wrong; see the withdrawn Finding #8.
- **6.1 ❌** — downgraded from ⚠️. The signature work does not raise the cost ceiling at all, and none of the three rate-limit gaps were addressed.
- **7.1 ✅** — `Access-Control-Allow-Origin: *` is **deliberately acceptable**. CORS is browser-enforced; the primary client is native. The wildcard grants nothing an attacker doesn't already have by extracting the publishable key and using `curl`. Tightening it would be security theatre.
- **8.1 ⚠️** — `scan-menu` validates size server-side (the control that matters for cost/DoS) but does no MIME/magic-byte check. `drink-image` still has **no `Content-Length` guard** (Finding #9).

---

## Verification Performed

- Full source read of all Edge Functions, shared modules, migration SQL, and client AI/analytics/persistence code — by four independent auditors.
- **Live** Supabase queries against `cmoaqgkzotvuvkqeyhhq`: `list_tables`, `pg_class.relrowsecurity`, `pg_policies`, `pg_proc` (definitions + ACLs), `storage.buckets` (→ 0), `pg_trigger`, and both security and performance advisors.
- **`get_edge_function` on both functions — deployed source diffed byte-for-byte against the working tree.** This is how the deployment drift was found: both are `version 2`, `verify_jwt: false`, and neither contains `signature.ts`, a `sig` field, or any `DRINK_SIGNING_SECRET` reference.
- `npm audit` executed; full dependency paths traced. `posthog-react-native`'s `peerDependenciesMeta` and `dist/optional/*` inspected to overturn the prior unused-dependency finding.
- `git log --all --diff-filter=A --name-only -- "*.env*"` — confirmed empty. `git check-ignore` on `.env.local` and `dist/`.
- Repo-wide grep for hardcoded secret patterns and `console.*` calls.
- Adversarial cryptographic review of `signature.ts`: canonicalization injectivity, constant-time verification, key-promise rejection caching, verify-before-quota ordering, replay/expiry, and sign-vs-verify string normalization.

**No changes were made to the codebase, the database, or any deployment during this audit.** All access was read-only.
