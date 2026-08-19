---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# Known Issues: Dead Routes & Leftovers

Code paths that are unused or leftover. Mostly safe to ignore, but candidates for cleanup.

> [!note] Related
> [[architecture/api-routes]] for the route list. [[tasks/todos]] for cleanup work.

> [!note] Resolved (2026-08-19)
> All of the below were removed or wired up on 2026-08-19:
> - `/api/export-pdf`, `/api/models`, the empty `app/api/generate/quiz/` dir, and `scripts/api-pdf-check.ts` were **deleted**. `PrintPanel` + `app/print.css` were **kept** — the client still renders them (`app/page.tsx`).
> - The non-streaming branch of `/api/generate` was **deleted** (the UI exclusively uses `?stream=true`).
> - `buildOfflineQuiz` (`reviewer-generator.ts`) was **deleted**.
> - `@sparticuz/chromium-min` was removed from deps. `playwright-core` + `pdfkit` were **kept** — dev scripts (`e2e.ts`, `pdf-check.ts`, `shot-landing.ts`) import them (the original audit note missed this).
> - `lib/verify.ts` is **no longer dead**: `verifyReviewerAgainstSource` is now wired into the streaming `/api/generate` path (see [[decisions/grounding-verification]]).

## Unused API routes

- **`/api/export-pdf`** — Server-side Playwright PDF export. **No UI caller**; superseded by client-side `@react-pdf/renderer` ([[decisions/pdf-export-strategy]]). Hardcodes a machine-specific Chromium path (`C:/Users/caloy/...`) that won't work on other machines.
- **`/api/models`** — GET `/models` listing per provider. **No UI caller**; appears to be debug/admin only.

## Empty route directory

- `app/api/generate/quiz/` exists but has **no `route.ts`**. Dead leftover; the quiz logic lives inside `app/api/generate/route.ts`.

## Other dead-ish surface

- `pdfkit` and `playwright-core` / `@sparticuz/chromium-min` are dependencies tied to the legacy server PDF route, which the UI no longer uses.
- `scripts/api-pdf-check.ts` exercises the unused server route (it would fail without a local Chromium install).

## Dead library code (confirmed by audit, 2026-08-19)

- **`lib/verify.ts`** — the entire file (`verifyReviewerAgainstSource`, `isQuestionGrounded`, token/formula extractors) has **zero callers**. The grounding-verification decision was never wired into `/api/generate`. See [[decisions/grounding-verification]].
- **`buildOfflineQuiz`** (`lib/reviewer-generator.ts:1477`) — exported but never called; `buildQuiz`/`buildQuizFromReviewer` are the live paths.
- **Non-streaming branch of `/api/generate`** (`route.ts:136-204`) — the only branch with a working offline fallback, but the UI exclusively uses `?stream=true`, so this code path is effectively dead. It also diverges in behavior from the streaming path (see [[known-issues/bugs|B2]]).

## Verification

`grep` for callers of `/api/export-pdf`, `/api/models`, `verifyReviewerAgainstSource`, and `buildOfflineQuiz` across `app/`, `components/`, `lib/` returns nothing — confirmed unused at the time this note was written.
