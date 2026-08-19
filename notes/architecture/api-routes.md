---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# API Routes

All handlers live under `app/api/`. They share the same guard pipeline from `lib/api-helpers.ts`: `originAllowed` (CSRF, 403) → `rateLimited` (429) → body-size check (`MAX_BODY_BYTES` 8MB) → JSON/validation checks.

> [!note] Related
> [[decisions/security-model]] documents the guard rationale. [[ai-generation]] powers `generate`; [[offline-engine]] powers the fallback and quiz.

## `/api/generate` — POST

The core generation endpoint. `runtime = "nodejs"`, `force-dynamic`, `maxDuration = 60`. Streaming only — there is no non-streaming JSON branch; the UI exclusively calls `?stream=true` (a request without it returns 400).

- Guards: origin, rate limit, body size, JSON validity, `sanitizeDocs` (1–5 docs with usable text), total chars ≤ 200,000.
- Requires at least one AI provider key (`buildProviderKeys()`), else throws.
- **Streaming (`?stream=true`)**: returns a `ReadableStream` SSE response. Emits `topics`, `terms` as they complete, then runs grounding verification (`verifyReviewerAgainstSource`) on the AI quiz, then `quiz`, then `done`. If questions were replaced, a `grounding` event with `{ replaced }` is emitted first. On error emits an `error` event (client triggers fallback). Consumed by `app/page.tsx` `runGeneration`.
- On AI failure, streams a complete offline-built reviewer over SSE (see [[known-issues/bugs|B2]]).
- Ungrounded AI questions (numbers/formulas absent from the source) are swapped with offline pool questions — see [[decisions/grounding-verification]].

## `/api/explain` — POST

Returns an AI explanation for why a quiz answer is correct. Consumed by `components/Quiz.tsx`.

- Iterates providers "fast-first" (`groq`, `mistral`, `sambanova`, `openrouter` then others), shuffling keys for load balancing.
- Gemini uses `generateContent` REST; others use OpenAI-compatible `/chat/completions`.
- Returns `{ explanation }` on first success, else 502.

## `/api/tutor` — POST

AI tutor chat grounded in the reviewer. Consumed by `components/TutorChat.tsx`.

- Strict system prompt: answer only from `<context>`, concise, no em-dashes/markdown, refuse off-topic, anti-leak.
- Sanitizes context, filters history to valid user/assistant messages.
- Gemini first, then other providers; 15s `AbortSignal.timeout` per call. Returns `{ reply }` else 502.

## Route-to-consumer map

| Endpoint | UI consumer |
|----------|-------------|
| `/api/generate?stream=true` | `app/page.tsx` |
| `/api/explain` | `components/Quiz.tsx` |
| `/api/tutor` | `components/TutorChat.tsx` |

The legacy `/api/export-pdf` and `/api/models` routes were removed on 2026-08-19 (see [[known-issues/dead-routes]]).
