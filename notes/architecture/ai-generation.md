---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# AI Generation

`lib/ai-generator.ts` — the multi-provider LLM engine. ~825 lines. Consumed by `/api/generate` (see [[api-routes]]).

> [!note] Related
> [[offline-engine]] seeds this engine (draft + protected facts). [[decisions/ai-provider-failover]] captures the failover reasoning.

> [!warning] Known defects in this engine
> - AI scenario questions all get `id: 0` and are never reassigned — breaks quiz tracking. See [[known-issues/bugs|B1]].
> - `conceptMap` shard output is not sanitized — malformed AI output crashes the Concept Map tab. See [[known-issues/bugs|B4]].
> - Gemini timeout is 120s while the route allows `maxDuration = 60`. See [[known-issues/bugs|P2]].

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
1. Topics
2. Terms
3. Scenario quiz

It merges the parts, calls `assembleReviewer(...)`, and only fails if **both** topics AND terms fail. `onProgress` streams per-task completion so the API route can emit SSE `topics`/`terms` events.

### `assembleReviewer(...)`
Merges/sanitizes shard output into a complete `ReviewerData` with `engine: "ai"`. Missing/null fields fall back to empty arrays (safe assembly).

## Provider call machinery

- `callProvider` — dispatches to Gemini REST or OpenAI-compatible endpoint.
- `callGemini` / `callOpenAICompat` — raw `fetch` with `AbortSignal.timeout` and JSON-schema prompting.
- `callWith429Retry` — one retry on rate-limit/quota errors.
- `preferredFor(taskIndex, available)` — **Gemini-first** rotation; a `rotationOffset` advances per call to spread load across keys.
- `runTask` — iterates providers → keys → models, collecting failures to fall back through the chain.
- `salvageJson` / `extractBalancedObjects` — recover truncated/malformed model JSON.

## Context / chunking

- `buildUserContent` — chunks docs fairly within `MAX_CONTEXT_CHARS = 40000`, `MAX_DOC_CHARS = 12000`.
- Embeds `protectedFacts` as verbatim constraints plus an optional offline `draft`.
- `stripCodeBlocks` / `condenseDoc` — drop large code blocks; long docs (>150 lines) are hierarchy-chunked preserving headings; headerless long docs fall back to an excerpted top/bottom with a `[... excerpted ...]` marker. (Covered by `__tests__/chunking.test.ts`.)

## Model selection order

`.env.example` documents the provider priority: **Gemini → Groq → OpenRouter → Mistral** (SambaNova also supported in code). Keys are server-only, never sent to the browser.
