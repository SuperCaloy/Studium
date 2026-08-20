---
created: 2026-08-19
last-updated: 2026-08-20
status: verified
---

# Index

Single entry point for the knowledge vault. Each top-level folder is listed with a one-line description and a wikilink to its key notes.

## Folders

- **[[architecture]]** — How the app is built and how data flows through it.
  - [[architecture/overview|Overview]] — Stack, SPA workflow, top-level map.
  - [[architecture/ai-generation|AI generation]] — Multi-provider LLM engine, sharding, failover, JSON salvage.
  - [[architecture/offline-engine|Offline engine]] — Deterministic NLP study-guide generation.
  - [[architecture/api-routes|API routes]] — `generate` (SSE), `explain`, `tutor`.
  - [[architecture/quiz|Quiz]] — Practice-quiz flow, answer review, scoring semantics.
  - [[architecture/persistence|Persistence]] — IndexedDB + localStorage/sessionStorage split.

- **[[decisions]]** — Decisions implied by the code and their reasoning.
  - [[decisions/ai-provider-failover|AI provider failover]] — Multi-provider rotation, key rotation, offline fallback.
  - [[decisions/grounding-verification|Grounding verification]] — Swap ungrounded AI quiz questions with offline ones.
  - [[decisions/pdf-export-strategy|PDF export strategy]] — Client-side `@react-pdf` supersedes server Playwright route.
  - [[decisions/security-model|Security model]] — Server-only keys, rate limiting, CSRF origin check.
  - [[decisions/schema-versioning|Schema versioning]] — `REVIEWER_SCHEMA_VERSION` and storage migration.
  - [[decisions/token-cost-reasoning|Token capacity & cost]] — Chunk budget math behind the 300k char ceiling.

- **[[known-issues]]** — Dead code, code smells, bugs, and security gaps.
  - [[known-issues/dead-routes|Dead routes]] — Legacy unused surface; all removed/wired up 2026-08-19.
  - [[known-issues/bugs|Bugs]] — Correctness & performance bugs; all B1-B12 and P1-P3 fixed (2026-08-20); B13 regression tracked (chunked topics drops conceptMap).
  - [[known-issues/security|Security audit]] — No auth, rate-limit gaps, CSRF/deployment caveats (S1–S5).
  - [[known-issues/code-smells|Code smells]] — Hardcoded paths, gitignore gaps, sharp override.

- **[[tasks]]** — Outstanding work / TODOs.
  - [[tasks/todos|TODOs]] — Skipped LLM eval, stub README, and more.
  - [[tasks/ui-polish|UI polish]] — Anti-slop elevation (Geist + Outfit, card/metric motion).
  - [[tasks/responsive-alignment-fix|Responsive alignment fix]] — Hero grid `items-start`, forced motion, mobile heights.
  - [[tasks/bugfix-round-2026-08-20|Bugfix round]] — B5, B9-B10, P1-P3 all resolved.
  - [[tasks/generation-ux-chunking-tutor|Generation UX, chunking, tutor]] — GenerationPanel, 300k char ceiling, tutor SSE overhaul.

- **[[ui]]** — UI quality / anti-slop review.
  - [[ui/anti-ui-slop-review|Anti-UI-slop review]]: Score bands, code-level hypotheses, visual-pass checklist.
  - [[ui/issues|UI issues]]: Technical terminology, duplicate controls (U1, U2, U3).

## Maintenance rules

- Keep this index in sync whenever a new top-level folder is created.
- Update `last-updated` in a note whenever it is revised.
- Review roughly every 10–15 sessions (or on request) for duplicate/overlapping notes and merge.
- Mark outdated notes with a deprecation callout rather than deleting them.
