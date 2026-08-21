---
created: 2026-08-19
last-updated: 2026-08-20
status: verified
---

# TODOs

Outstanding work and improvement opportunities, including the 2026-08-19 audit findings.

> [!note] Related
> [[known-issues/bugs]], [[known-issues/security]], [[known-issues/dead-routes]], and [[known-issues/code-smells]] contain the detail behind several of these.

## Bugfix round (DONE 2026-08-20)

- **B5** setState side effects, **B9** dashboard tab reset, **B10** body-size check, **P1** quadratic splitting, **P2** generation time budget, **P3** redundant offline draft. All fixed. See [[tasks/bugfix-round-2026-08-20|Bugfix round]] and [[known-issues/bugs|Bugs]].

## Critical fixes (audit — DONE 2026-08-19, see [[known-issues/bugs|Resolved]])

- **Fix quiz id collision** — AI scenario questions all shared `id: 0`. ✅ Sequential ids in `parseScenarioQuizPart`.
- **Fix streaming fallback / data loss** — AI failure saved an empty reviewer over the previous good one. ✅ Server now streams an offline-built reviewer over SSE; client saves only on `done` and restores the previous reviewer on failure.
- **Fix inverted "NOT an example" answers**. ✅ `correctAnswerIndex` now points at the non-example distractor.
- **Regression tests added** in `__tests__/bug-regressions.test.ts` (B1, B3, offline-fallback guard for B2). Note: `__tests__/` is still git-ignored — see "Tests/scripts out of VCS" below.
- **Quiz could not finish on the last question** — reveal button was disabled once `answered >= total`; "Finish" never appeared (user-reported at 10/20/30/50/70). ✅ Removed the disable; the last question now shows an always-available **Submit** button (`components/Quiz.tsx`). See [[known-issues/bugs|B11]].

## High value

- **Remove dead routes / deps** — delete or officially deprecate `/api/export-pdf`, `/api/models`, the empty `app/api/generate/quiz/`, the dead `lib/verify.ts`, `buildOfflineQuiz`, the non-streaming `/api/generate` branch, and unused deps (`pdfkit`, `playwright-core`, `@sparticuz/chromium-min`). See [[dead-routes]]. ✅ DONE 2026-08-19: routes, quiz dir, `api-pdf-check.ts`, non-streaming branch, `buildOfflineQuiz`, and `@sparticuz/chromium-min` removed; `verify.ts` is now wired in (see below). `pdfkit`/`playwright-core` kept — dev scripts use them.
- **Wire up grounding verification** — call `verifyReviewerAgainstSource` in `/api/generate` so the [[decisions/grounding-verification]] decision actually takes effect. ✅ DONE 2026-08-19: wired into the streaming path; `grounding` SSE event reports the replacement count.
- **Write a real README** — the current `README.md` is an empty stub (`# Name / Synopsis / ...`). Document setup, env vars, scripts. ✅ DONE 2026-08-19.

## Medium

- **Auth + per-account quotas** — all AI endpoints are public; only IP rate limiting protects the API budget. Add authentication and per-user limits. See [[security|S1]]. (Deferred — needs a database; project is currently serverless/no-DB.)
- **Schema migration path** — `REVIEWER_SCHEMA_VERSION = 2` currently discards all persisted reviewers on any schema mismatch. Consider a migration path instead of destructive clearing. ✅ DONE 2026-08-19: pure `migrateReviewer` (`lib/migrations.ts`) backfills/normalizes in place; only structurally unrecoverable data is cleared. See [[decisions/schema-versioning]].
- **Rate limiting** — the in-memory fallback isn't shared across instances, and `clientIp` coalesces to `"unknown"` on self-hosted deploys (one bucket for everyone). See [[security|S1]]. ✅ Partially done 2026-08-19: `clientIp` reads `x-forwarded-for`; bare `next start` still coalesces (needs a proxy or auth). Shared store via Upstash remains optional.
- **Tests/scripts out of VCS** — `__tests__/` is git-ignored, so tests never run in CI and aren't reviewed. Consider tracking them (or at least running them in CI). ✅ DONE 2026-08-19: removed `__tests__` from `.gitignore`.
- **Sanitize `conceptMap` + add an error boundary** — malformed AI output crashes the Concept Map tab; no boundary means a white screen. ✅ DONE 2026-08-19: sanitized in `sanitizeParts` + `components/ErrorBoundary.tsx` wraps `Dashboard`. See [[bugs|B4]].
- **Fix quadratic sentence splitting** — `extractTerms`/`buildQuiz` re-split the full document per frequency word. ✅ DONE 2026-08-20: splits memoized/computed once (P1).
- **Time budget for generation** — `maxDuration = 60` vs Gemini timeout 120s + 429 retry can strand a stream. ✅ DONE 2026-08-20: `maxDuration = 300` + 240s deadline racing offline fallback (P2).
- **Remove the skip on the live-LLM eval** — `__tests__/meta-language-eval.test.ts` contains a skipped placeholder for a live-LLM meta-language evaluation. Either implement with a real key or remove the placeholder.

## Low / housekeeping

- **Fix `.gitignore` gap** — add `scripts/pdf-check-zero-margin.pdf` (and other generated script PDFs) so they're ignored. See [[code-smells]].
- **Revisit `sharp` override** — confirm the `next → sharp ^0.35.0` override is still needed on dependency upgrades.
- **Review em-dash constraint** — multiple scripts assert no em-dash in output (`/api/explain` and `/api/tutor` prompts also forbid it). If intentional, document why; it's an unusual global constraint.
- **Deduplicate `shuffle`** and split `reviewer-generator.ts` (1560 lines). See [[code-smells]].
- **Security headers / CSP** in `next.config.mjs`. See [[security|S5]].
- **Lint script is broken** — `npm run lint` fails with "Invalid project directory ... \lint": `next lint` was removed in Next.js 16. Either switch to `eslint` directly (needs an ESLint config + `eslint` dev dep — neither exists yet) or drop the script.
- **Misc robustness**: guard `TutorChat` sessionStorage parse (✅ B7 fixed), delay object-URL revoke in `ExportBar` (✅ B8 fixed), reset `Dashboard` tab on reviewer change (✅ B9 fixed 2026-08-20).

## Version 2 roadmap (proposed, needs scoping)

- **Auth + server-side accounts/history** — DB-backed persistence (replaces the single-active-reviewer IndexedDB model); per-user saved reviewers, history, sharing.
- **Per-account quotas & cost controls** — model picker, per-provider budget, response caching (ties into S1).
- **OCR for scanned PDFs** — currently flagged `scanned` and abandoned; add server-side OCR + extraction fallback.
- **Grounding everywhere** — apply `verify.ts`, add source citations on terms/topics.
- **Real streaming progress** — per-task percent updates; generous `maxDuration`; no stranded streams (ties into P2). ✅ DONE 2026-08-20: dedicated `GenerationPanel` driven by real SSE `progress` events (step, percent, topics/terms/quiz counts, chunks done/total); dashboard swaps in only on `done`. See [[tasks/generation-ux-chunking-tutor]].
- **Export breadth** — Markdown/DOCX export, printable answer keys.
- **Reliability & process** — error boundaries, split `reviewer-generator.ts`, un-ignore tests + CI, ESLint config, a11y fixes (`userScalable: false` blocks zoom).
