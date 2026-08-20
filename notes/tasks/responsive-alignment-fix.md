---
created: 2026-08-20
last-updated: 2026-08-20
status: done
area: [frontend, ui]
---

# Responsive Alignment + Force Motion Fix (Studium)

Fix the reported hero-section misalignment ("the box goes up when I add files, no longer aligned to the word") plus force motion regardless of OS reduced-motion preference.

## Context

- User reported on desktop and phone: when a file is added, the upload box shifts relative to the hero headline.
- Root cause: hero grid used `items-center` (`app/page.tsx`). With `items-center`, the shorter left column re-centers vertically whenever the right column (Dropzone + FileQueue + Generate bar) grows taller, so the headline and box lose top alignment.
- User also asked to force animations independent of the OS `prefers-reduced-motion` setting.

## Steps

- [x] Hero grid `items-center` -> `items-start` in `app/page.tsx`. Now both columns anchor at the top; adding files only grows the right column downward. Applies to desktop and the single-column mobile stack.
- [x] Force motion regardless of OS: wrap the Home return in `<MotionConfig reducedMotion="never">` from `motion/react`, removed `useReducedMotion()` hook and its gating on the feature-card `whileHover={{ y: -6 }}`. CSS animations (`slide-up`, `fade-in`, `pulse-soft`) already ignore OS settings, so no change needed there.
- [x] `components/ConceptMap.tsx`: fixed `h-[800px]` changed to `h-[65vh] min-h-[400px]` so the map fits mobile viewports (desktop keeps a taller canvas).
- [x] Geometry verification via new `scripts/geo-check.ts` (Playwright, measured geometry, not visual): desktop 1440 hero top == dropzone top; hero top unchanged after adding a file; mobile 375/390 no horizontal overflow; hero and dropzone share the same left edge; Document Queue renders below the dropzone. 6/6 passed.
- [x] `npm run build` and `npm test` (33 passed, 1 skipped) both green.

## Tradeoff noted

`MotionConfig reducedMotion="never"` overrides an OS accessibility preference (WCAG 2.3.3 motion animation). This was an explicit user request for the portfolio showcase. If accessibility matters later, re-add gating.

## Related

- [[ui/anti-ui-slop-review|Anti-UI-slop review]]
- [[architecture/overview|Architecture overview]]