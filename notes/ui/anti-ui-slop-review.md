---
created: 2026-08-20
last-updated: 2026-08-20
status: verified
---

# Anti-UI-Slop Review (Studium)

> [!note] Visual review completed
> A formal visual review was conducted on 2026-08-20 based on direct high-fidelity dark-mode screenshots of Studium running in production. This note contains the official score, design analysis, and concrete improvement plans.

## GenerationPanel + Tutor UI (added 2026-08-20)

Replaced the fake-progress `ProgressSteps` component with a dedicated **`components/GenerationPanel.tsx`** shown on the landing view during streaming. It renders:

- A gradient progress bar driven by real SSE `progress` events (percent clamped 4-100).
- Step pills (`Chunking -> Topics -> Terms -> Quiz -> Done`) with `animate-pulse-soft` on the active step; `activeIndex` maps `extracting` to Topics until `terms > 0` then Terms.
- Live metric cards: topics, terms, quiz questions, chunks `done/total` (no token readout, per decision).
- A Cancel button (aborts the AbortController).

The dashboard no longer swaps in until the `done` SSE event; a failed stream restores the previous reviewer.

**`components/TutorChat.tsx`** was rebuilt for SSE streaming: streaming bubble with a blinking caret (`animate-pulse bg-brand`), a Stop button (AbortController) that keeps partial text, per-message Copy, and a "Try again" retry affordance on failed replies (no generic "Oops" text injected as an assistant message). It now sends the full reviewer context (topics with details + facts + terms + summary) via `lib/tutor-context.ts` `buildTutorContext` so the tutor can actually answer questions the notes cover. Two robustness bugs found in post-implementation review and fixed: the abort path read a stale `streamText` state closure instead of the local accumulator (partial replies were lost on Stop), and a stream ending without a terminal `done`/`error` event silently dropped the reply.

**Unsupported-file feedback** (2026-08-20): both Dropzone usages in `app/page.tsx` now pass `onUnsupportedFiles`, which shows an amber warning notice ("Only PDF, DOCX, or TXT files are accepted. Ignored: <names>"). `showNotice` gained an `info | warning` variant; `components/Dropzone.tsx` input `accept` is now `.pdf,.docx,.txt`.

## Implementation (2026-08-20, shipped in v1.5.0)

The improvement plan was executed. Applied changes:

1. **Typography**: `font-display` is now **Outfit** (a distinctive geometric sans) via `--font-outfit` in `app/layout.tsx` and `fontFamily.display` in `tailwind.config.ts`. Body/UI stays **Geist**. Applied to the hero heading, "What you get" header, and all existing `font-display` titles (Header, SummaryPanel, Dropzone, Flashcards, Quiz). Outfit has no italic, so the hero accent uses `font-bold` of the same font. This replaces the earlier Geist-everywhere default and the prior "Removed Newsreader" decision, which is now stale.
2. **Feature cards** (`app/page.tsx`): cards are now `motion.div` with a spring `whileHover={{ y: -6 }}` (stiffness 300, damping 22), disabled under `prefers-reduced-motion` via `useReducedMotion()`.
3. **Metric cards** (`components/SummaryPanel.tsx`): hover border/glow (`hover:border-brand/40 hover:shadow-md`), larger `text-xl tabular-nums` values, and an icon scale + color transition on group-hover.
4. `package.json` version bumped 1.0.0 -> 1.5.0.

Verification: `npm run build` (with TS check) and `npm test` (33 passed, 1 skipped) both green.

### Follow-up fix (2026-08-20)

Hero grid `items-center` -> `items-start` in `app/page.tsx` so the left column stays top-anchored when files are added (user-reported "box goes up" bug). Motion is now forced regardless of OS via `<MotionConfig reducedMotion="never">`; `useReducedMotion()` gating removed per explicit user request. `ConceptMap.tsx` height `h-[800px]` -> `h-[65vh] min-h-[400px]` for mobile. Verified with `scripts/geo-check.ts` (6/6 geometry checks) plus build + tests. See [[tasks/responsive-alignment-fix|Responsive alignment + force motion fix]].

## Official UI Slop Score: 15 / 100

### Score Band: 0–29 (Specific enough to ship)
*Guideline: Keep checking real states and responsive behavior. The UI is custom, extremely polished, highly cohesive, and tightly aligned with the student-reviewer domain.*

---

## Visual Design Analysis

Studium has an exceptionally high level of polish. It does **not** feel like generic, interchangeable AI template slop. 

### What makes it highly specific and professional (Strengths)
1. **Domain-Specific States:** The loading state during generation is highly custom. The combination of a detailed text-progress tracker ("Finding the most important topics and terms...") with a linear progress bar and multi-step phase pills ("Reading...", "Organizing...") is functional and beautifully styled.
2. **Asymmetrical Layouts:** The landing feature grid ("What you get") breaks boring symmetry by using asymmetrical card spans (wide cards for "Accelerated Learning" and "Active Recall Engine", smaller cards for the others). This is a strong visual design pattern that signals custom craft.
3. **Outstanding Dark Mode Integration:** The dark theme is cohesive and rich. It uses a clean neutral dark palette (deep zinc/slate) highlighted by a customized, premium teal accent family (`#0f766e` base, `#2dd4bf` light). Border weights, background tints, and gradients feel highly deliberate.
4. **Rich Information Architecture:** The Dashboard page features a high-density, highly readable layout containing an informative metrics grid (Documents, Words, Pages, Study Time) and a beautiful active tab navigator with quantitative badges (e.g., `Quiz [100]`, `Terms [27]`).

---

## Actionable Improvement Plan (To go from 15 → 5)

While the UI is fully ready to ship, here are three highly targeted, non-disruptive refinements to push it to a world-class, premium level for a professional portfolio:

### 1. Brand Typography Refinement (Identity)
- **Observation:** The app uses Geist Sans for both headings and body text. It is clean and legible, but Geist is the standard Vercel default, which makes tech sites look slightly interchangeable.
- **Suggestion:** Introduce a slightly more academic or editorial display typeface for headings to lean into the **"Studium"** brand identity.
- **Action:** 
  - Keep a clean sans-serif (like Geist or Inter) for the dense body text, tables, and buttons.
  - Pair it with a highly polished display serif (like *Playfair Display*, *Lora*, or *Newsreader*) or a humanist geometric sans (like *Plus Jakarta Sans*) for the main hero headline ("Upload your notes. Ace your exams.") and panel titles.

### 2. Interactive Micro-previews (Engagement)
- **Observation:** The "What you get" landing cards are beautifully proportioned, but they use static icons and text.
- **Suggestion:** Add subtle micro-animations or visual previews on hover to make the features feel alive.
- **Action:** 
  - For **Active Recall Engine (Flashcards)**, make the icon or card border subtly shift perspective, or trigger a 3D-card-flip visual placeholder on hover.
  - For **Adaptive Quizzing**, make the icon checkmarks transition or "draw" when hovered.

### 3. Metric Card Styling (Dashboard Polish)
- **Observation:** The dashboard metrics cards (Documents, Words, Pages, Est. study time) are clean but feel slightly flat compared to the gorgeous, glowing "Study reviewer ready" banner above them.
- **Suggestion:** Make the numeric indicators pop more.
- **Action:** 
  - Increase the font size of the metric values (e.g., the numbers `1`, `1,792`, `15`, `9 min`) and give them a vibrant teal text color (`text-brand-light` / `text-teal-400`).
  - Add a very soft, low-opacity teal background tint or a subtle internal border glow on hover.

---

## Related Notes
- [[index]]: Knowledge Vault Index
- [[architecture/overview]]: App architecture map
