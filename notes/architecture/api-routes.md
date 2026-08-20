---
created: 2026-08-19
last-updated: 2026-08-20
status: verified
---

# API Routes

All handlers live under `app/api/`. They share the same guard pipeline from `lib/api-helpers.ts`: `originAllowed` (CSRF, 403) → `rateLimited` (429) → body-size check (`MAX_BODY_BYTES` 8MB) → JSON/validation checks.

> [!note] Related
> [[decisions/security-model]] documents the guard rationale. [[ai-generation]] powers `generate`; [[offline-engine]] powers the fallback and quiz.

## `/api/generate` — POST

The core generation endpoint. `runtime = "nodejs"`, `force-dynamic`, `maxDuration = 300`. Streaming only — there is no non-streaming JSON branch; the UI exclusively calls `?stream=true` (a request without it returns 400).

- Guards: origin, rate limit, body size (checked on the raw body byte length, not just `content-length`), JSON validity, `sanitizeDocs` (1–5 docs with usable text), total chars ≤ 300,000 (~75,000 words).
- Requires at least one AI provider key (`buildProviderKeys()`), else streams the offline fallback.
- **Streaming (`?stream=true`)**: returns a `ReadableStream` SSE response. Emits `progress` (with `step`, `percent`, `message`, running `topics`/`terms`/`quiz` counts and `chunksDone`/`chunksTotal`), then `topics`/`terms` as each phase finishes, then runs grounding verification (`verifyReviewerAgainstSource`) on the AI quiz, then `quiz`, then `done`. If questions were replaced, a `grounding` event with `{ replaced }` is emitted first. On error streams a complete offline-built reviewer over SSE (see [[known-issues/bugs|B2]]). Consumed by `app/page.tsx` `runGeneration` (which swaps to the dashboard only on `done` and restores the previous reviewer on failure).
- Ungrounded AI questions (numbers/formulas absent from the source) are swapped with offline pool questions — see [[decisions/grounding-verification]].

## `/api/explain` — POST

Returns an AI explanation for why a quiz answer is correct. Consumed by `components/Quiz.tsx`.

- Iterates providers "fast-first" (`groq`, `mistral`, `sambanova`, `openrouter` then others), shuffling keys for load balancing.
- Gemini uses `generateContent` REST; others use OpenAI-compatible `/chat/completions`.
- Output token cap raised 150 -> 500 on 2026-08-20 so explanations are not cut off.
- Returns `{ explanation }` on first success, else 502.

## `/api/tutor` — POST

AI tutor chat grounded in the reviewer. Consumed by `components/TutorChat.tsx`.

- System prompt: answer fully from `<context>`, never truncate, no em-dashes/markdown, refuse only genuine injection/leak attempts, always answer when the info IS in context, plus a "what is Studium" exception.
- Sanitizes context (strips `<context>` tags, capped 40k chars), slices `message` to 2000 chars, filters history to valid user/assistant messages (last 12 at 2000 chars each).
- Gemini first, then other providers. `MAX_TOKENS` raised 300 -> 1200 (2026-08-20).
- **Streaming (`?stream=true`)**: SSE `delta` / `done` / `error` events for both Gemini (`streamGenerateContent`) and OpenAI-compatible (`stream: true`) paths, 30s timeout per provider. Non-streaming JSON path kept for backward compatibility.

## Route-to-consumer map

| Endpoint | UI consumer |
|----------|-------------|
| `/api/generate?stream=true` | `app/page.tsx` |
| `/api/explain` | `components/Quiz.tsx` |
| `/api/tutor` | `components/TutorChat.tsx` |

The legacy `/api/export-pdf` and `/api/models` routes were removed on 2026-08-19 (see [[known-issues/dead-routes]]).
