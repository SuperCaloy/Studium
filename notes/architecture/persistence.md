---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# Persistence

Three storage layers with distinct roles. See [[decisions/schema-versioning]] for migration handling.

> [!note] Related
> [[overview]] shows where persistence sits in the workflow. All state is orchestrated from `app/page.tsx`.

## IndexedDB (`lib/storage.ts`, via `idb`)

DB name `reviewer-generator`, version 1, three object stores: `documents`, `reviewers`, `meta`. Lazy cached DB promise (`getDB`).

- `saveDocuments` / `loadDocuments` / `removeDocument` / `clearDocuments` — the uploaded `ExtractedDocument`s.
- `saveReviewer` — **deletes all other reviewers first** (single-active-reviewer model), then puts the new one.
- `loadReviewers` / `loadLatestReviewer` — returns most recently `updatedAt` reviewer; older schemas are **migrated in place** via `migrateReviewer` (`lib/migrations.ts`), and only structurally unrecoverable data is cleared.
- `clearReviewers` / `clearAll` — clears docs + reviewers in one transaction.

## localStorage

- Flashcards SRS boxes: `srs-<reviewerId>` (see [[overview]] → Flashcards).
- Quiz target count: `reviewer-target` (also restored on hydration in `page.tsx`).
- Theme (via next-themes).

## sessionStorage

- Tutor chat history: `tutor_chat_<reviewer.id>`.

## Hydration flow (`app/page.tsx`)

On mount: `loadDocuments()` + `loadLatestReviewer()` restore the prior session; `normalizeIds` guarantees stable term/topic IDs; the saved `reviewer-target` is restored. Queue changes persist documents back to IndexedDB.
