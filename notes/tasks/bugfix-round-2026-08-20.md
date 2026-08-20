---
created: 2026-08-20
last-updated: 2026-08-20
status: done
area: [frontend, backend, performance]
---

# Bugfix Round: B5, B9-B10, P1-P3 (Studium)

Close out every open correctness and performance bug recorded in [[known-issues/bugs]] as of 2026-08-19.

## Context

The audit note listed B5, B9-B10 (correctness) and P1-P3 (performance) as open. The user asked to fix all of them. See [[known-issues/bugs|Known issues]] for the original write-ups.

## Steps

- [x] **B5** (`app/page.tsx`): `handleFiles` no longer runs side effects (notices via `setTimeout`, async `extractText`) inside the `setQueue` updater. New items are computed from `queueRef.current` (kept in sync via an effect), `setQueue` is a pure append, and notices/parsing run after. `handleRemove` moved its `removeDocument` call out of the updater as well. StrictMode double-invocation no longer duplicates parsing/notices.
- [x] **B9** (`components/Dashboard.tsx`): an effect resets `tab` to `"summary"` whenever the active tab is no longer visible for the current reviewer (e.g. Concept Map gone after an AI->offline regen).
- [x] **B10** (`app/api/generate/route.ts`): reads the raw body with `req.text()`, enforces `MAX_BODY_BYTES` on the actual byte length, then parses JSON. No longer trusts the spoofable/omittable `content-length` header.
- [x] **P1** (`lib/reviewer-generator.ts`): `extractTerms` memoizes sentence splits per text (local `Map` + shared `allSentences` getter) and reuses one split per source doc; `buildQuiz`'s word-blank loop computes `splitSentences(text)` once. Kills the O(terms x doc) re-splitting.
- [x] **P2** (`app/api/generate/route.ts`): `maxDuration` 60 -> 300; AI generation races a 240s deadline so a slow/retrying provider falls back to the offline reviewer instead of being killed mid-stream.
- [x] **P3** (`lib/reviewer-generator.ts` + route): `prepareDraft` takes `{ skipTopicTermExtraction }`; the AI path passes it so expensive offline `extractTerms`/`buildTopicsForDocs` don't run on every generation. `buildOfflineReviewer` still computes the full draft on AI failure. Tradeoff: partial AI failure (topics ok, terms fail) loses the offline draft hint for the missing part.
- [x] Regression tests: 2 new tests in `__tests__/bug-regressions.test.ts` (P3 skip option + full-draft unchanged).
- [x] Verify: `npm run build` and `npm test` (35 passed, 1 skipped) both green.

## Related

- [[known-issues/bugs|Known issues: bugs]]
- [[tasks/todos|TODOs]]
- [[architecture/overview|Architecture overview]]