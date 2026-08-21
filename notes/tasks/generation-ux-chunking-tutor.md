---
created: 2026-08-20
last-updated: 2026-08-20
status: done
area: [frontend, backend, ai]
---

# Generation UX, Chunking, Tutor Chat Overhaul

Refines the study reviewer web app in three coordinated areas: generation loading UX, backend chunking with no term cap-out, and the Tutor Chat feature. Full plan and reasoning live in this note.

> [!note] Related
> [[architecture/ai-generation]], [[architecture/api-routes]], [[architecture/overview]], [[known-issues/bugs]], [[ui/anti-ui-slop-review]], [[decisions/ai-provider-failover]], [[decisions/token-cost-reasoning]]

## Completed (2026-08-20)

All six parts shipped. Post-implementation audit ran `security-review` and `code-review-and-quality` skills; two robustness bugs found and fixed in `components/TutorChat.tsx` (stale closure lost partial replies on Stop; stream ending without a terminal event silently dropped the reply). Permanent notes updated: [[architecture/ai-generation]], [[architecture/api-routes]], [[ui/anti-ui-slop-review]], [[decisions/token-cost-reasoning]], [[known-issues/code-smells]].

## Known Regression (Discovered 2026-08-20)

- **B13** — Chunked topics task drops `conceptMap`, `title`, `overview`, `keyTakeaways`. See [[known-issues/bugs|B13]]. Fix pending: update `salvageJson` fallback to merge all fields.

## Decisions (user-confirmed 2026-08-20)

- Generation loading pattern: **dedicated generation view** (`GenerationPanel`), not an instant skeleton dashboard swap.
- Total document ceiling: **300k chars across all docs** (~75k tokens, ~250k tokens per generation). No token readout in the UI.
- Tutor context: **full reviewer** (topics + facts + terms + summary), server cap raised 20k -> 40k chars.
- Tutor UI: **full overhaul** - SSE streaming, caret, Stop, per-message retry + copy.
- `/api/explain` output tokens 150 -> 500.
- Post-implementation: run `security-review` + `code-review-and-quality` skills, then write review notes.

## Why 300k chars

At ~4 chars/token, 300k chars is ~75k source tokens. Chunked into ~12k-char chunks that is ~25 chunks x 2 tasks (terms + topics) = ~50 provider calls per generation, ~170k input + ~80k output tokens. 400k would be ~68 calls and ~340k tokens (~26% heavier). 300k keeps a sane free-tier margin on Gemini (~500k-1M tokens/day) while removing the 20-30 term cap-out. See Part 2.

## Checklist

### Part 0 - Task note
- [x] Create this note (frontmatter, checklist, decisions).
- [x] After implementation: set `status: done`, check off steps, add wikilinks to produced notes.

### Part 1 - Generation UX: dedicated generation view
- [x] `app/page.tsx`: `runGeneration` stops faking progress (remove 12/30/55% + `sleep` steps).
- [x] Replace `ProgressSteps` usage with new `GenerationPanel` on the landing view during streaming.
- [x] Swap to the dashboard only on the `done` SSE event (keep restore-previous-on-failure behavior).
- [x] `components/GenerationPanel.tsx`: gradient progress bar from real SSE `progress` events, step pills (`Chunking -> Topics -> Terms -> Quiz -> Done`), live metric cards (topics, terms, quiz, chunks `done/total`), Cancel. No token readout.
- [x] `lib/types.ts`: `GenerationProgress` gains `topics, terms, quiz, chunksDone, chunksTotal`.
- [x] Remove `ProgressSteps` usage (component may be deleted).

### Part 2 - Chunking + remove artificial caps
- [x] `lib/ai-generator.ts`: new `chunkDocuments(docs, ~12000)` emitting all chunks (no `[... truncated ...]`).
- [x] `generateCards` runs terms/topics per-chunk (concurrency 2-3), merges + dedupes (terms by `stemKey`, topics by heading).
- [x] `onProgress` reports per-chunk totals.
- [x] Dynamic caps: `termCap = min(400, max(40, round(wordCount/30)))`; remove fixed `.slice(0,60)` / `.slice(0,400)` in `assembleReviewer`; Gemini `maxOutputTokens` -> 32000.
- [x] System prompts: "be exhaustive", "do not omit major sections".
- [x] `lib/reviewer-generator.ts:1391`: offline termCap short 30->60, cap 60->150.
- [x] `app/api/generate/route.ts`: total-char guard 200k -> 300k.
- [x] `lib/api-helpers.ts`: `MAX_TEXT_CHARS` per-doc 50000 -> 100000.

### Part 3 - Tutor Chat
- [x] `app/api/tutor/route.ts`: `MAX_TOKENS` 300 -> 1200.
- [x] SSE `?stream=true` on `/api/tutor` (`delta` / `done` / `error`, both Gemini + OpenAI paths).
- [x] Context cap 20k -> 40k.
- [x] Soften anti-leak/off-topic rules (refuse only genuine injection/leak attempts; "always answer if in context").
- [x] `components/TutorChat.tsx`: send full reviewer context (topics w/ details + facts + terms + summary).
- [x] Streaming bubble with blinking caret; Stop (AbortController); retry + copy on failure/empty/refusal; no generic "Oops" injected as assistant message.
- [x] `app/api/explain/route.ts`: output 150 -> 500.

### Part 4 - Unsupported-file notification
- [x] `app/page.tsx`: pass `onUnsupportedFiles` to both Dropzone usages; amber/red notice variant; "Only PDF, DOCX, or TXT files are accepted. Ignored: <names>".
- [x] `components/Dropzone.tsx`: `accept=".pdf,.docx,.txt"` (stays `multiple`).

### Part 5 - Verification
- [x] `npm run build` + `npm test` after each phase.
- [x] New tests: chunking merge/dedupe, dynamic term caps, tutor context builder (no false refusal), SSE `progress` shape.

### Part 6 - Post-implementation review
- [x] Run `security-review` skill on changed routes (`/api/generate`, `/api/tutor`, `/api/explain`).
- [x] Run `code-review-and-quality` skill on the diff.
- [x] Update `notes/architecture/ai-generation.md` (chunking + dynamic caps + `progress` event).
- [x] Update `notes/architecture/api-routes.md` (tutor SSE + context changes).
- [x] Update `notes/ui/anti-ui-slop-review.md` (GenerationPanel + tutor UI) or add a new UI note.
- [x] Create `notes/decisions/` note for token-capacity/cost reasoning if warranted.
- [x] Add any audit-discovered bugs to `notes/known-issues/`.
- [x] Update `notes/index.md` + frontmatter `last-updated` on every touched note.