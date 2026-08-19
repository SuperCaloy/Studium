---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# Offline Engine

`lib/reviewer-generator.ts` — the deterministic, no-AI study-guide generator. The largest lib file (~1560 lines). Works with zero API keys.

> [!note] Related
> [[overview]] describes how it fits the dual-engine design. [[decisions/ai-provider-failover]] explains why it exists as the fallback. It also seeds [[ai-generation]].

## Purpose

Produces a complete `ReviewerData` (`engine: "offline"`) from document text using pure NLP/heuristic rules. Also builds quiz banks and an offline draft that seeds the AI engine.

## Fallback behavior (updated 2026-08-19)

Since the B2 fix, `/api/generate?stream=true` streams a complete offline reviewer over SSE whenever AI generation throws (instead of sending an `error` event and leaving the client on an empty skeleton). The client saves only after a `done` event and restores the previous reviewer on failure — see [[known-issues/bugs|B2]] and [[todos]].

## Main exports

- `prepareDraft(docs)` → `{ cleanedDocs, text, draft, protectedFacts, protectedSpans }` — master pipeline:
  - strip metadata/reference lines
  - extract **protected spans** (LaTeX `$...$`, `\[...\]`, `\(...\)`, units, equations, chemical formulas — deliberately rejects code-looking lines)
  - extract terms, build topics, pick overview / title / takeaways
- `buildOfflineReviewer(docs, questionTarget)` — full offline build.
- `buildQuizFromReviewer(topics, terms, keyTakeaways, sourceText, questionTarget)` — quiz derived from an already-built reviewer (used by AI pipeline to merge a procedural quiz, and as the grounding replacement pool).
- `normalizeIds(topics, terms)` — guarantees stable unique IDs (called on hydration in `page.tsx`).
- `factsFromSpans(spans)` — converts protected spans into `Fact[]`.

## Heuristic machinery

- Large word-list + regex dictionaries: `STOPWORDS` (incl. Filipino), `JUNK_TERMS`, `CODING_TERMS`, `MATH_TERMS`, `SCIENCE_TERMS`, `DEFINITION_PATTERNS`, `HEADING_PATTERNS`, metadata-line strippers.
- `extractProtectedSpans` — LaTeX / unit / equation / formula detection.
- `buildQuiz` — True/False (term-swap, negation, plain), definition MCQ, fill-in-blank, "Which is correct", NOT-example, and numeric-value questions.
- Sentence splitting via `Intl.Segmenter`, tokenizer, stemmer, term scoring, heading-similarity merging.

## QA

`scripts/quiz-clean-check.ts` feeds messy OCR-like text through `buildQuiz` and asserts the generated True/False questions are clean (no bullets/pipes, headers, stray numbers, rubric text, broken negations). `__tests__/reviewer-generator.test.ts` covers `assembleReviewer` (AI-side), not the offline builder directly.
