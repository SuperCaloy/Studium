---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# Known Issues: Security Audit

Findings from the full-codebase audit on 2026-08-19. This app is a no-auth, public SPA — the biggest risk is **resource abuse of the paid AI endpoints**. No XSS sinks were found anywhere (no `dangerouslySetInnerHTML`/`eval`; React auto-escaping is the only render path).

> [!note] Related
> Intended security posture is documented in [[decisions/security-model]] — these are the gaps against it.

> [!note] Resolved (2026-08-19)
> **S2** is fixed and **S1** is partially addressed (see below). Auth (S1's main defense) is deferred until a database is in scope.

## S1 — No authentication; rate limiting is the only defense (Medium)

- All API routes (`/api/generate`, `/api/explain`, `/api/tutor`) are public. Anyone can burn AI credits.
- The in-memory rate-limit fallback (`lib/api-helpers.ts`) is **per-instance** — ineffective on multi-instance/serverless deploys.
- **Partially addressed 2026-08-19**: `clientIp` now reads the first `x-forwarded-for` entry (`lib/api-helpers.ts`), so deployments behind a trusted proxy get per-IP buckets. On bare `next start` (no proxy) all clients still coalesce to a shared `"unknown"` bucket — that needs a trusted proxy (or auth), not a code fix.
- **V2 priority**: add auth + per-account quotas. See [[tasks/todos]].

## S2 — `originAllowed` trusted spoofable `x-forwarded-host` (Low) — FIXED 2026-08-19

- **Location**: `lib/api-helpers.ts`.
- **Impact**: a raw HTTP client could spoof both `Origin` and `x-forwarded-host` to pass the CSRF check on non-Vercel deploys.
- **Fix**: `originAllowed` now compares against the `Host` header only and ignores `x-forwarded-host` entirely. Regression test: `__tests__/api-helpers.test.ts`. **Done 2026-08-19**.

## S3 — Gemini API keys in URL query strings (Low)

- `?key=...` on `lib/ai-generator.ts:572` (callGemini), `app/api/explain/route.ts:88`, `app/api/tutor/route.ts:99`. Standard Gemini API pattern, but keys are visible in upstream/proxy access logs.
- **2026-08-19**: the tutor route now `encodeURIComponent`s the key (`tutor/route.ts`), matching `ai-generator.ts`. Remaining exposure is the inherent `?key=` query-string pattern.

## S4 — SSE `error` event leaks provider error bodies (Low)

- `generate/route.ts:119` sends `err.message` over the stream; these can contain upstream HTTP response text (e.g. truncated provider error bodies). Client logs it to the console.

## S5 — No security headers / CSP on app pages (Low)

- `next.config.mjs` is only `reactStrictMode`. Add a CSP and standard headers for a hardening pass.

## Notes (not findings)

- **Prompt injection** in `/api/tutor` / `/api/explain`: user messages and reviewer-derived context (which originates from user-uploaded, untrusted docs) are injected into LLM prompts. Mitigated only by LLM-level guardrails (anti-leak directive). Same-user scope only, so no cross-user impact — acceptable for the current threat model, but a per-user risk for public deployment.
- **`content-length`-based body cap** is bypassable; downstream bounds (`sanitizeDocs`, 200k char cap) keep it contained.
- **2026-08-19 hardening** — `/api/tutor` input-size caps (message ≤ 2000 chars, last-12 history messages ≤ 2000 chars each, context ≤ 20k chars) bound per-request token cost even though `MAX_BODY_BYTES` (8MB) is the only raw-payload guard; chat input enforces `maxLength={2000}`. The `context` field is now type-guarded so malformed bodies get a 400 instead of a TypeError.