---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# Decision: Security Model

API keys are server-only; every API route enforces origin/CSRF checks and per-IP rate limiting; request bodies are size/format validated.

> [!note] Related
> Implementation in `lib/api-helpers.ts`, applied across [[architecture/api-routes]]. Keys are documented in `.env.example` (names only — never store real values in `notes/`).

## What the code implies

- **Server-only keys**: `buildProviderKeys()` reads env vars server-side; keys are never sent to the browser. All provider calls happen in API routes.
- **CSRF / origin check**: `originAllowed(req)` validates host + origin/referer on every route (403 on mismatch or missing both). `clientIp` resolves via `req.ip` → `x-real-ip`, deliberately ignoring spoofable `x-forwarded-for`.
- **Rate limiting**: `rateLimited(key)` uses Upstash Redis sliding window (15/60s) when env is configured, else an in-memory `Map` fallback with lazy cleanup + size cap. Applied per-IP to all endpoints.
- **Body validation**: `MAX_BODY_BYTES` 8MB (413), `sanitizeDocs` bounds docs (1–5, usable text), total chars ≤ 200,000 (413). Every route validates JSON shape (400) and reviewer shape (`isValidReviewer`) before processing.
- **`/api/tutor` guardrails**: prompt-level rules (answer only from context, refuse off-topic, anti-leak) to prevent prompt injection / leakage.
- **SSE error handling**: generation errors surface as an `error` event → client falls back to offline rather than exposing internals.

## Why

- Prevent key theft (never ship secrets to the client).
- Throttle abuse of paid LLM endpoints.
- Block cross-origin request forgery against routes that call external APIs.

## Known gap

Rate limiting falls back to an in-memory map when Upstash is not configured — fine for a single instance, but not shared across instances. See [[tasks/todos]].

> [!warning] Audit gaps (2026-08-19)
> See [[known-issues/security]] for the full audit. Highlights:
> - **No authentication anywhere** — all AI endpoints are public; only IP rate limiting protects the paid API budget.
> - On self-hosted `next start`, `clientIp` returns `"unknown"` for every client → one shared rate-limit bucket per instance.
> - `originAllowed` trusts client-supplied `x-forwarded-host` (CSRF check bypassable by raw clients on non-Vercel deploys).
> - SSE `error` events can leak upstream provider error text to the client.
