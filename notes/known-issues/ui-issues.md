---
created: 2026-08-20
last-updated: 2026-08-20
status: draft
---

# Known Issues: UI Polish & Terminology

User-reported UX issues discovered during review of the GenerationPanel and document queue header.

## U1 — Technical Terminology in GenerationPanel

- **Location**: `components/GenerationPanel.tsx` (metrics grid labels, step pills)
- **Impact**: Developer-facing jargon leaks into student UI. "Chunks" and "Chunking" are internal LLM concepts, not user concepts.
- **Current labels**:
  - Step 1 pill: "Chunking" → should be "Preparing"
  - Metrics card: "Chunks" → should be "Parts" (e.g. "0/14 parts")
  - Progress message: "Splitting documents into chunks..." → should be "Preparing your study materials..."
- **Fix**: Rename labels to user-friendly terms. See [[tasks/generation-ux-chunking-tutor|Generation UX task]].

## U2 — Duplicate Cancel Buttons in Document Queue Header

- **Location**: `app/page.tsx` lines 482-494 (file queue header when `generating === true`)
- **Impact**: Two "Cancel" buttons visible simultaneously:
  1. Header bar: "Generating..." badge + "Cancel" button
  2. GenerationPanel below: dedicated "Cancel" button
- **User confusion**: Redundant controls, unclear which to click.
- **Fix**: When `generating === true`, hide the entire action button block in the file queue header. Show only the read-only status text ("X files ready · Y MB total"). The GenerationPanel owns the cancel action.
- **Related**: "Clear all" button should also be hidden during generation (files are locked).

## U3 — "Generating..." Badge Styled as Button But Unclickable

- **Location**: `app/page.tsx` lines 484-487
- **Impact**: Visual element looks like a disabled button (`opacity-80 cursor-not-allowed`) but serves no purpose. GenerationPanel already shows progress.
- **Fix**: Remove entirely when U2 fix is applied.