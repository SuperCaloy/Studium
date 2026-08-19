---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# Decision: Schema Versioning

The `ReviewerData` shape is versioned (`REVIEWER_SCHEMA_VERSION = 2`). Persisted reviewers are migrated in place by a pure `migrateReviewer` (`lib/migrations.ts`); only structurally unrecoverable data is discarded.

> [!note] Related
> [[architecture/persistence]] (storage layer), [[architecture/overview]].

## What the code implies

- `REVIEWER_SCHEMA_VERSION = 2` lives in `lib/types.ts` (single source of truth for all domain types).
- `saveReviewer` stores the reviewer as-is; `loadLatestReviewer` runs every loaded reviewer through `migrateReviewer`.
- `migrateReviewer` backfills missing fields (`conceptMap`, `version`), normalizes quiz questions (including remapping colliding legacy ids), and returns `null` only when the value is structurally unrecoverable.

## Why

- A stale reviewer from an older schema is still mostly usable; discarding it silently is data loss.
- Keeps a single migration entry point so future schema changes just extend `migrateReviewer`.

## Trade-offs

- Migration is a heuristic backfill, not a field-by-field schema map — very old shapes may lose fields the normalizer doesn't know about.
- Written 2026-08-19 replacing the previous "clear everything on version mismatch" behavior ([[known-issues/bugs|B6]]).
