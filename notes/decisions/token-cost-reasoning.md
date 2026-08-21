---
created: 2026-08-20
last-updated: 2026-08-20
status: verified
---

# Token Capacity & Cost Reasoning

Why the generation pipeline chunks documents and where the 300k total-char ceiling comes from. This decision directly shapes `lib/ai-generator.ts` (chunking + dynamic caps) and `/api/generate` (the 300k guard). See [[architecture/ai-generation]] and [[tasks/generation-ux-chunking-tutor]].

> [!note] Related
> [[architecture/ai-generation]], [[decisions/ai-provider-failover]], [[architecture/api-routes]]

## The problem this solves

Before 2026-08-20 the AI backend hard-capped terms at 20-30 for any corpus and ran the whole corpus through a single 40k-char context, so large documents silently lost coverage. The fix has two parts:

1. **Chunk the corpus** so every document is actually fed to the model (topics + terms per chunk, merged/deduped).
2. **Cap total corpus size** so a generation stays within a sane free-tier token budget.

## Token math (approximate, ~4 chars/token)

| Corpus | Source tokens | Chunks (~12k chars) | Provider calls (topics + terms) | Input tokens | Output tokens | Total per generation |
|--------|--------------|---------------------|---------------------------------|--------------|---------------|----------------------|
| 300k chars | ~75k | ~25 | ~50 | ~170k | ~80k | ~250k |
| 400k chars | ~100k | ~34 | ~68 | ~220k | ~120k | ~340k |

- Gemini free tier: roughly 500k-1M tokens/day, so ~2-4 full 300k-char generations per day. That margin is why 300k was chosen over 400k.
- Chunked calls are N+1 small requests, so Groq/OpenRouter free TPM (tokens per minute) and RPM (requests per minute) walls can slow a generation; concurrency is capped at 2 and each chunk failure retries/failovers through the provider chain (`runChunkedTask`).

## Cost controls chosen

- **300k total chars** across all docs (guard in `/api/generate`, error tells the user ~75,000 words). Up from 200k.
- **`MAX_TEXT_CHARS` per doc 50k -> 100k** (`lib/api-helpers.ts`).
- **Chunk size ~12k chars** with concurrency 2; hard-slice oversized single sections (no `[... truncated ...]` markers in the chunked path).
- **Dynamic output caps** instead of fixed ceilings: `termCap = min(400, max(40, round(totalWords/30)))`, `topicCap = min(80, max(10, round(totalWords/150)))`. The offline engine got the same treatment (short docs 60, long docs 150).
- **Tutor chat**: full-reviewer context capped at 40k chars, `MAX_TOKENS` 1200 per reply, history trimmed to the last 12 messages at 2000 chars each -> roughly 16-21k tokens per message.
- **`/api/explain`**: output 150 -> 500 tokens.
- **No token readout in the UI**: the number would be noisy/confusing for a student product; the ceilings are the actual guardrail.

## Accepted tradeoffs

- Free-tier users could burn a full day's Gemini budget with 2-4 large generations; the offline fallback still produces a usable reviewer when the providers are exhausted, and `callWith429Retry` + failover handle quota errors.
- Chunked topics/terms are merged by title/term (case-insensitive) so duplicate headings across chunks are not double-counted; genuinely distinct sections keep their own entries.