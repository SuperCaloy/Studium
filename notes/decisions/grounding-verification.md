---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# Decision: Grounding Verification

> [!note] Implemented (2026-08-19)
> `verifyReviewerAgainstSource` is now called in the streaming `/api/generate` path. The AI quiz is verified against the source; questions citing numbers/formulas absent from the source are replaced with grounded offline questions, and the remaining target is topped up from the unused pool. A `grounding` SSE event reports the replacement count (the client ignores unknown events). `VerificationResult` now also returns the leftover `pool`. Tests: `__tests__/verify-grounding.test.ts`.

The intended design — check AI quiz questions against the source text and swap ungrounded ones with replacement questions from the offline pool.

> [!note] Related
> Implementation in `lib/verify.ts`. Backs [[architecture/api-routes]] `generate`. See [[decisions/ai-provider-failover]] for the AI context it post-processes.

## What the code implies

`verifyReviewerAgainstSource(reviewer, sourceText, offlinePool)`:

- `extractSignificantTokens(text)` — compacts numeric tokens (e.g. `12.5km` → `12.5km`, `%` → `percent`).
- `extractFormulas(text)` — operator/equation/chemical-formula fragments.
- `isQuestionGrounded(q, sourceNums, sourceFormulas)` — **rejects** a question that cites numbers or formulas absent from the source.
- On rejection, replaces the question with an unused offline-pool replacement and records it as `replaced`.

## Why

- LLMs hallucinate specific figures/equations; a study guide that states wrong numbers is actively harmful.
- Blends the best of both engines: AI-written questions for coverage, offline questions as a verified fallback pool.

## Trade-offs

- Replacement logic only swaps *individual questions*; a wholesale grounding failure isn't surfaced distinctly (the `replaced` count exists but isn't strongly surfaced to the user).
- Grounding checks are heuristic (token/formula matching), not semantic.
