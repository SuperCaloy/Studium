---
created: 2026-08-19
last-updated: 2026-08-20
status: verified
---

# AI Generation

`lib/ai-generator.ts` — the multi-provider LLM engine. ~1085 lines. Consumed by `/api/generate` (see [[api-routes]]).

> [!note] Related
> [[offline-engine]] seeds this engine (draft + protected facts). [[decisions/ai-provider-failover]] captures the failover reasoning. [[decisions/token-cost-reasoning]] documents the chunk budget math behind the 300k char ceiling.

> [!warning] Known defects in this engine
> - **B13 (REGRESSION 2026-08-20)** — Chunked topics task drops `conceptMap`, `title`, `overview`, `keyTakeaways`. `salvageJson` fallback discards scalar fields on truncation. See [[known-issues/bugs|B13]]. Fix pending: update `salvageJson` to merge all parsed fields.
> - B1 (AI quiz ids) and B4 (`conceptMap` unsanitized) and P2 (timeout mismatch) are all fixed (2026-08-19/20); timeout note reads `maxDuration = 300` with 240s race deadline. See [[known-issues/bugs|bugs]].

## Providers

Five providers, each either `kind: "gemini"` or `kind: "openai"` (OpenAI-compatible `/chat/completions`):

- Mistral
- Gemini
- Groq
- OpenRouter
- SambaNova

Each has `baseUrl`, models, caps, and timeouts. Per-provider model overrides come from env vars (`<PROVIDER>_MODEL`). See `lib/api-helpers.ts` `buildProviderKeys()` and `.env.example`.

## Main entry: `generateCards(...)`

Runs **3 parallel tasks**:
1. Topics (per-chunk)
2. Terms (per-chunk)
3. Scenario quiz (single pass over the whole corpus)

It merges the parts, calls `assembleReviewer(...)`, and only fails if **both** topics AND terms fail. `onProgress` streams per-chunk progress so the API route can emit SSE `progress`/`topics`/`terms` events.

### `assembleReviewer(...)`
Merges/sanitizes shard output into a complete `ReviewerData` with `engine: "ai"`. Missing/null fields fall back to empty arrays (safe assembly). The fixed `.slice(0,60)` (topics) and `.slice(0,400)` (terms) caps were removed on 2026-08-20; caps are now dynamic (see below).

## Chunking (added 2026-08-20)

- `chunkDocuments(docs, maxChars = 12000)` — splits every doc into `DocChunk { label, text }` segments. Preserves headings via hierarchy detection; a single oversized section is hard-sliced at `maxChars`. No artificial `[... truncated ...]` markers are ever inserted (that marker still exists only in `buildUserContent`/`condenseDoc`, which are now unused by the chunked path).
- `runChunkedTask(...)` — runs a task (topics or terms) per chunk with `mapWithConcurrency(..., 2)`, merging partials via `mergeTopics` (dedupe by lowercase title) and `mergeTerms` (dedupe by lowercase term). Uses lenient chunk parsers `parseTopicsPartLenient` / `parseTermsPartLenient` that do NOT throw on empty arrays, so a chunk with no topics/terms is not treated as a provider failure.
- Dynamic caps (replaces the old hard 20/100/400 caps): `termCap = min(400, max(40, round(totalWords/30)))`, `topicCap = min(80, max(10, round(totalWords/150)))`.

## Provider call machinery

- `callProvider` — dispatches to Gemini REST or OpenAI-compatible endpoint.
- `callGemini` / `callOpenAICompat` — raw `fetch` with `AbortSignal.timeout` and JSON-schema prompting.
- `callWith429Retry` — one retry on rate-limit/quota errors.
- `preferredFor(taskIndex, available)` — **Gemini-first** rotation; a `rotationOffset` advances per call to spread load across keys.
- `runTask` — iterates providers → keys → models, collecting failures to fall back through the chain.
- `salvageJson` / `extractBalancedObjects` — recover truncated/malformed model JSON.

## Context / pre-filtering

- `buildUserContent` — used only by the scenario-quiz task now; chunks docs fairly within `MAX_CONTEXT_CHARS = 40000`, `MAX_DOC_CHARS = 12000`.
- Embeds `protectedFacts` as verbatim constraints plus an optional offline `draft`.
- `stripCodeBlocks` / `condenseDoc` — drop large code blocks; long docs (>150 lines) are hierarchy-chunked preserving headings; headerless long docs fall back to an excerpted top/bottom with a `[... excerpted ...]` marker. (Covered by `__tests__/chunking.test.ts`.)

## Model selection order

`.env.example` documents the provider priority: **Gemini → Groq → OpenRouter → Mistral** (SambaNova also supported in code). Keys are server-only, never sent to the browser.
