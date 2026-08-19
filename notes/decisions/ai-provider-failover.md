---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# Decision: AI Provider Failover

The app supports five AI providers with automatic rotation and a fully offline fallback, so generation works with no keys, partial keys, or rate-limited/failing providers.

> [!note] Related
> [[architecture/ai-generation]] is the implementation; [[architecture/offline-engine]] is the fallback.

## What the code implies

- **Multi-provider chain**: Mistral, Gemini, Groq, OpenRouter, SambaNova — each `kind: "gemini"` or `"openai"`-compatible, so one abstract `callProvider` handles them.
- **Rotation**: `preferredFor(taskIndex, available)` picks a provider, Gemini-first, advancing a `rotationOffset` per call to spread load. `runTask` iterates providers → keys → models, collecting failures to fall through the chain.
- **Key rotation**: env supports `_2`..`_5` suffixes (Gemini) and comma-separated lists; keys are shuffled for load balancing (see `/api/explain`).
- **429 retry**: `callWith429Retry` gives one retry on rate-limit/quota errors.
- **Offline fallback**: if no keys are configured or all providers fail, `/api/generate` uses `buildOfflineReviewer(docs, 70)` and sets `fallback = true`. The client shows an amber warning.
- **Provider priority** (from `.env.example`): Gemini → Groq → OpenRouter → Mistral.

## Why

- Resilience: a study tool should never hard-fail generation; degrade to offline rather than error.
- Cost/limits: rotating across providers and keys avoids single-provider rate limits.
- Self-hosting friendliness: works with whatever key(s) the operator has.

## Trade-offs

- Multi-provider code is more complex (dispatch, JSON salvage, per-provider quirks).
- Output can vary by provider; grounding verification [[decisions/grounding-verification]] mitigates hallucination drift.
