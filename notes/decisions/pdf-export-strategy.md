---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# Decision: PDF Export Strategy

PDF generation is done **client-side** with `@react-pdf/renderer` (`PdfDocument` / `ExportBar`). A server-side Playwright export route exists but is unused by the UI.

> [!note] Related
> [[architecture/overview]] (print/PDF duality), [[architecture/api-routes]] (the legacy route), [[known-issues/dead-routes]] (the unused route).

## What the code implies

- **Active path**: `components/ExportBar.tsx` renders `<PdfDocument>` → `pdf(doc).toBlob()`, then downloads via an anchor + object URL, with a `window.print()` fallback on mobile error. Preview shows in a modal `<iframe>`.
- `PdfDocument.tsx` is the A4 document definition ("Academic" design tokens: cover, summary takeaways, key facts, topics→details→points, glossary boxes). Uses default Times-Roman/Helvetica.
- **Legacy path**: `/api/export-pdf` renders `PrintPanel` via `renderToStaticMarkup`, launches headless Chromium, and `page.pdf()`s it. **No UI consumer.**

## Why (inferred)

- Client-side generation avoids server compute, per-request Chromium cost, and the fragile browser-launch path.
- Better UX (instant, no server round-trip), works on static/edge deploys.
- The server route predates this and was kept but orphaned.

## Parallel print path

`window.print()` uses `app/print.css` + `PrintPanel` — a separate HTML print layout from the `@react-pdf` PDF. Both are maintained; scripts `pdf-check.ts` / `api-pdf-check.ts` enforce strict print margins (≥15/15/12/12 mm) and a no-cover/no-quiz/no-em-dash print design.

## Trade-offs / risk

- `@react-pdf/renderer` runs in-browser and bundles font logic client-side.
- Two print/PDF representations to keep in sync (PrintPanel CSS vs PdfDocument).
- Legacy server route is dead weight — see [[tasks/todos]].
