---
created: 2026-08-19
last-updated: 2026-08-20
status: verified
---

# Known Issues: Code Smells & Config Gaps

Minor issues, inconsistencies, and things to watch. None are blocking.

> [!note] Related
> [[dead-routes]] for unused code. [[tasks/todos]] for actionable follow-ups.

## Machine-specific hardcoded path (RESOLVED 2026-08-19)

`/api/export-pdf` hardcoded `DEFAULT_CHROMIUM_EXE` to a local `C:/Users/caloy/AppData/Local/ms-playwright/chromium-1217/...` path. Dev-only; broke on other machines. **Done 2026-08-19**: the route was deleted (see [[dead-routes]]).

## `.gitignore` gaps (RESOLVED 2026-08-19)

- `scripts/pdf-check-zero-margin.pdf` was not gitignored (only `scripts/pdf-check.pdf` was).
- **Done 2026-08-19**: replaced with `scripts/*.pdf`, covering all generated script PDFs.

## Test & script suites git-ignored (RESOLVED 2026-08-19)

- `__tests__/` was git-ignored, so the unit tests lived outside version control and CI couldn't run them. **Done 2026-08-19**: removed `__tests__` from `.gitignore`.

## `sharp` override

`package.json` pins `next → sharp ^0.35.0` via `overrides` — a workaround for a Next.js/Sharp compatibility issue. Worth revisiting on dependency upgrades.

## No ESLint config file

Linting relies solely on Next's built-in `next lint` (default config). No custom `.eslintrc`. `lint` script is `next lint`.

## `.next/types` & typed routes

`tsconfig.json` includes `.next/types` (typed routes). Fine, but it means type errors can surface only after a build/dev run generates types.

## Readme

`README.md` is an empty `# Name / Synopsis / ...` stub — not informative. See [[tasks/todos]].

## Audit additions (2026-08-19)

- **Duplicate `shuffle`** — `lib/utils.ts` and a private copy in `lib/reviewer-generator.ts:307`. Reuse the shared one.
- **`lib/reviewer-generator.ts` is 1560 lines** — past the ~1000-line healthy boundary. Split candidates: term extraction, quiz builder, metadata stripping.
- **No auth anywhere** — covered in [[security|S1]].
- **`dashboard` tab state survives tab removal** — regenerating to an offline reviewer removes the Concept Map tab while `tab` may still point at it. See [[bugs|B9]].
- **Client error boundary** — ✅ added 2026-08-19 (`components/ErrorBoundary.tsx` wrapping `Dashboard`), see [[bugs|B4]]. Remaining panels without a boundary guard are lower risk now that `conceptMap` is sanitized server-side.

## Audit additions (2026-08-20)

- **`lib/ai-generator.ts` is now ~1085 lines** — past the ~1000-line healthy boundary after chunking was added. Split candidates: chunking (`chunkDocuments`/`runChunkedTask`/`mergeTopics`/`mergeTerms`), provider call machinery, parsers.
- **`components/TutorChat.tsx` uses `JSON.parse(dataMatch[1])` on SSE payloads** — if a proxy splits a JSON object across chunks the regex `/data: (.*)/` only captures a single line; SSE data from the app is always single-line `JSON.stringify` output, so this is safe today but worth noting if multi-line event data is ever introduced.
- **Unused `buildUserContent` truncation path** — `buildUserContent`/`condenseDoc` still emit `[... truncated ...]` markers, but the chunked path (`chunkDocuments` + `chunkUserContent`) no longer uses them; the markers survive only as a scenario-quiz fallback. Not dead, but the divergence is confusing.
