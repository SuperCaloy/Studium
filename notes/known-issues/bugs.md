---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# Known Issues: Correctness & Performance Bugs

Confirmed by a full-codebase audit on 2026-08-19. File:line references point at the code as of that audit; see the "Resolved" callout for fixes applied the same day. Security findings live in [[security]].

> [!warning] Active bugs
> B5, B9–B10 and P1–P3 below are still open. B5 (setState side effects) affects dev only. P1 (quadratic splitting) is the main performance concern.

## Resolved (2026-08-19)

> [!note] Fixed
> - **B1** — `parseScenarioQuizPart` now assigns sequential ids (`lib/ai-generator.ts`), so AI scenario questions no longer all collide on `id: 0`. Regression test: `__tests__/bug-regressions.test.ts`.
> - **B2** — streaming `/api/generate` now builds and streams a complete offline reviewer over SSE when AI fails; the client only calls `saveReviewer` after a `done` event, and restores the previous reviewer instead of leaving/saving an empty skeleton. See [[architecture/offline-engine]].
> - **B3** — NOT-an-example questions now mark the non-example `distractor` as correct (`lib/reviewer-generator.ts`). Regression test: `__tests__/bug-regressions.test.ts`.
> - **B4** — `sanitizeParts` now sanitizes `conceptMap` (3 non-empty strings per mapping, max 15), and `assembleReviewer` uses the sanitized value; added `components/ErrorBoundary.tsx` wrapping `Dashboard` in `app/page.tsx`.
> - **B11** — quiz could not finish on the last question. The reveal/"Check answer" button was `disabled` once `answered >= total`, which becomes true on the last question right after picking an option → "Finish" never appeared. Removed the disable; the last question now shows an always-available **Submit** button (`components/Quiz.tsx`).
> - **B6** — destructive schema wipe replaced with a real migration. New pure `migrateReviewer` (`lib/migrations.ts`) backfills missing fields and remaps colliding quiz ids; `loadLatestReviewer` only clears data that is structurally unrecoverable. Tests: `__tests__/storage-migration.test.ts`.
> - **B7** — unguarded `JSON.parse` in `TutorChat.tsx` is now wrapped in try/catch with an `Array.isArray` shape check; corrupt `sessionStorage` falls back to the default greeting instead of crashing.
> - **B8** — the preview blob URL is now revoked when it is replaced or the component unmounts (`components/ExportBar.tsx`); the download path revokes after `click()`, which is reliable on current browsers.
> - **B12** — AI scenario questions bypassed string sanitization. `parseScenarioQuizPart` now string-coerces `question`/`options`/`explanation` (objects/arrays coerce to `""` and the question is dropped, non-integer or out-of-range `correctAnswerIndex` is dropped). Red-first tests: `__tests__/ai-generator.test.ts`.
> - **Tutor cost caps** — `/api/tutor` now slices `message` to 2000 chars, keeps only the last 12 history messages at 2000 chars each, and caps `context` at 20k chars; the chat input enforces `maxLength={2000}` (`components/TutorChat.tsx`).

## High impact

### B1 — AI quiz questions all share `id: 0` (FIXED 2026-08-19)
- **Location**: `lib/ai-generator.ts:203` (`parseScenarioQuizPart` hardcoded `id: 0` with a "Assigned later" comment); ids were never reassigned when merged in `app/api/generate/route.ts:108-112`.
- **Impact**: `Quiz.tsx` keys `answers`/`checked`/`aiExplanations` by `q.id`. Every AI scenario question collided on id 0 → answering/revealing one overwrites the others; scoring and the "missed questions" review were wrong for all AI questions.
- **Fix**: assign sequential ids in `parseScenarioQuizPart` (or remap in the route). **Done 2026-08-19**: sequential ids in `parseScenarioQuizPart`.

### B2 — Streaming generation failure produces an empty reviewer, not the offline fallback (FIXED 2026-08-19)
- **Location**: `app/api/generate/route.ts:117-123` (streaming path sent an `error` event and never built the offline reviewer) + `app/page.tsx:373-387` (client kept the empty skeleton and called `saveReviewer`).
- **Impact**: The UI only calls `?stream=true`. On any AI failure (including **no API keys configured**):
  1. The user got an empty dashboard (no offline reviewer was generated, despite the "fallback" UI flag).
  2. The empty skeleton **overwrote the previous good reviewer** in IndexedDB (`storage.ts:71-80` single-active model) — the prior study guide was lost.
- **Fix**: stream the offline-built reviewer over SSE on AI failure; only `saveReviewer` on a successful/complete stream. **Done 2026-08-19**: server streams offline reviewer; client saves only on `done` and restores the previous reviewer on failure.

### B3 — "Which is NOT an example?" questions are inverted (FIXED 2026-08-19)
- **Location**: `lib/reviewer-generator.ts:1207-1228`.
- **Impact**: The question asked for the item that is *not* an example, but `correctAnswerIndex` pointed at `list.items[0]` — an item that *is* an example. Marked-correct answer contradicted the question.
- **Fix**: point `correctAnswerIndex` at the non-example `distractor`, or change the question wording to "Which is an example?". **Done 2026-08-19**: `correctAnswerIndex` now points at the `distractor` and the explanation states it is not an example.

## Medium

- **B4 — `conceptMap` from AI is unsanitized (FIXED 2026-08-19)** — `assembleReviewer` passed `parts.conceptMap` through unchanged (`ai-generator.ts:392`). A malformed `mappings` (not an array) crashed `ConceptMap.tsx:83` (`.forEach` on a non-array). No error boundary existed → white screen. **Done 2026-08-19**: sanitized in `sanitizeParts` + `components/ErrorBoundary.tsx` wraps `Dashboard` in `app/page.tsx`.
- **B5 — Side effects inside a `setState` updater** — `handleFiles` runs async `extractText` and schedules notices inside the `setQueue` updater (`page.tsx:137-219`). Double-invoked in StrictMode dev → duplicate parsing/notices.
- **B6 — Destructive schema migration (FIXED 2026-08-19)** — `loadLatestReviewer` cleared all persisted reviewers on schema mismatch (`storage.ts:91`). No migration path. **Done 2026-08-19**: `migrateReviewer` (`lib/migrations.ts`) backfills/normalizes in place; only structurally unrecoverable data is cleared.
- **B12 — AI scenario questions bypass string sanitization (FIXED 2026-08-19)** — `assembleReviewer` injected `parts.scenarioQuestions` raw (`ai-generator.ts:412`), skipping the `sanitizeParts` that topics/terms get; `parseScenarioQuizPart` only truthy-checked `question`/`explanation` and length-checked `options`. An LLM returning `options: [42, {}, "x", true]` stored an object in `quizBank` → React render throw (caught by the ErrorBoundary, but the Quiz UI degraded). **Done 2026-08-19**: `parseScenarioQuizPart` string-coerces every field via `toDisplayString`, drops questions with empty options or non-integer `correctAnswerIndex`. Tests: `__tests__/ai-generator.test.ts`.

## Low

- **B7 — Unguarded `JSON.parse(sessionStorage)` in `TutorChat.tsx` → crash on corrupt data (FIXED 2026-08-19)** — wrapped in try/catch with `Array.isArray` shape check; corrupt storage falls back to the default greeting.
- **B8 — Object URL lifecycle in `ExportBar.tsx` (FIXED 2026-08-19)** — download-path revoke-after-click is reliable on current browsers; the preview blob URL leaked on unmount and is now revoked in an effect cleanup.
- **B9 — Dashboard tab can stay active after it disappears** — e.g. regenerating from AI → offline removes the Concept Map tab while `tab` is still `"map"`; panel renders the empty state under a de-highlighted tab (`Dashboard.tsx`).
- **B10 — Body-size check relies on `content-length`** header (`generate/route.ts:35`) which can be omitted/spoofed; downstream `sanitizeDocs` + char caps bound it, so impact is limited.

## Performance

- **P1 — Quadratic text processing** — `extractTerms` (`reviewer-generator.ts:597`) and `buildQuiz` (`:1268`) call `allSentences`/`splitSentences` (full-doc `Intl.Segmenter` re-split) inside per-frequency-word loops → O(terms × doc) on large docs (up to 200k chars). Memoize sentence splits once.
- **P2 — `maxDuration = 60` vs Gemini timeout 120s + 429 retry** (`ai-generator.ts:57,481`) — on serverless the streaming function can be killed mid-generation; client is left on a partial stream. Needs a per-request time budget.
- **P3 — `prepareDraft` always runs before AI** in the streaming path (`generate/route.ts:86`) — full offline NLP cost is paid on every generation even when AI succeeds.