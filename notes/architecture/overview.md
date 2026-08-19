---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# Architecture Overview

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS single-page application that converts uploaded study documents into a study guide ("reviewer").

> [!note] Related
> Deep-dives: [[ai-generation]], [[offline-engine]], [[api-routes]], [[persistence]]. Decisions: [[decisions/ai-provider-failover]], [[decisions/pdf-export-strategy]].

## What the app does

The entire product lives on one route (`/`, `app/page.tsx`). The workflow is:

1. **Upload** — drag/drop or pick up to 5 PDF/DOCX/TXT files (max 10MB each, deduped by name+size).
2. **Parse locally** — text extraction happens in the browser via `lib/text-extractor.ts` (pdfjs-dist, mammoth, BOM-aware txt decoding). Detects `scanned` / `low-text` / `empty` flags.
3. **Generate** — POST `/api/generate?stream=true`; an SSE stream progressively builds the reviewer (`topics` → `terms` → `quiz` → `done`). Cancel via `AbortController`; a generation token guards stale streams.
4. **View** — a tabbed `Dashboard` renders the result.

There is no server-side page rendering beyond the shell; everything user-facing is a client component.

## Core building blocks

| Layer | Module | Responsibility |
|-------|--------|----------------|
| **State owner** | `app/page.tsx` | Queue, reviewer, progress, target, fallback; orchestrates SSE; hydrates from IndexedDB. |
| **Client parsing** | `lib/text-extractor.ts` | PDF/DOCX/TXT → `ExtractedDocument`. |
| **Offline engine** | `lib/reviewer-generator.ts` | Deterministic NLP generation (`buildOfflineReviewer`), quiz builder, draft seed for AI. |
| **AI engine** | `lib/ai-generator.ts` | Multi-provider LLM generation (`generateCards`, `assembleReviewer`), failover, JSON salvage. |
| **Grounding** | `lib/verify.ts` | Checks AI quiz questions against the source and swaps ungrounded ones (numbers/formulas absent from source) with grounded offline questions. Wired into the streaming `/api/generate` path. See [[decisions/grounding-verification]]. |
| **Server helpers** | `lib/api-helpers.ts` | Rate limiting, provider key loading, body validation, CSRF origin check. |
| **Persistence** | `lib/storage.ts` | IndexedDB for docs + single latest reviewer; schema-versioned. |
| **UI panels** | `components/` | Dashboard tabs: Summary, Topics, Terms, Facts, Flashcards, Quiz, Tutor, ConceptMap, Export. |

## Two generation engines

- **Offline** (`reviewer-generator.ts`): pure heuristics, no API keys, deterministic. Used when no AI keys are configured or all providers fail (fallback).
- **AI** (`ai-generator.ts`): parallel sharded generation across providers (Mistral, Gemini, Groq, OpenRouter, SambaNova), seeded by an offline draft + protected facts to keep output grounded.

This split is a deliberate resilience decision — see [[decisions/ai-provider-failover]].

## Client vs server split

- **Server components**: `layout.tsx` (shell + fonts + metadata) and all API route handlers.
- **Client components**: `page.tsx` (the app), `Providers.tsx` (next-themes), and every feature component.
- The only React context is `next-themes` `ThemeProvider`; all other shared state lives in `page.tsx`.

## Persistence split

- IndexedDB (`lib/storage.ts`): uploaded documents + the single latest reviewer.
- `localStorage`: flashcards SRS boxes (`srs-<reviewerId>`), quiz target (`reviewer-target`), theme.
- `sessionStorage`: tutor chat history (`tutor_chat_<reviewer.id>`).

See [[persistence]].

## Print / PDF duality

The reviewer is printed via `app/print.css` (`PrintPanel`) and exported via client-side `@react-pdf/renderer` (`PdfDocument`). A server-side Playwright export route exists but is unused — see [[decisions/pdf-export-strategy]].
