---
created: 2026-08-20
last-updated: 2026-08-20
status: done
area: [frontend, ui]
---

# UI Polish: Anti-slop Elevation (Studium)

Follow-up to the [[ui/anti-ui-slop-review|Anti-UI-slop review]] (score 15/100, band 0-29 "specific enough to ship"). Goal: push the landing and dashboard from very clean to a bespoke, premium portfolio showcase without breaking the current cohesive style.

## Constraints (AGENTS.md + skills)

- No em-dashes anywhere in code or notes.
- `design-taste-frontend` skill: serif is discouraged as a default. A past decision exists: `app/layout.tsx` previously had `// Removed Newsreader to stick to Geist sans`, now replaced by the Geist + Outfit setup.
- Use `motion/react` (already used in `Flashcards.tsx`), not `framer-motion` imports.
- `@phosphor-icons/react` preferred over `lucide-react`, but lucide is already the project dependency, so keep lucide.
- Respect `prefers-reduced-motion`.
- Surgical changes only.

## Steps

- [x] Decide font direction: user chose **Geist + Outfit** on 2026-08-20 (Outfit for display, Geist for body/UI). Avoids slop fonts per `design-taste-frontend` (Inter discouraged; Fraunces/Instrument Serif banned as defaults) and `ui-ux-pro-max` (academic pairing Crimson Pro + Atkinson Hyperlegible considered but not needed). A prior code comment said Newsreader was removed to stick to Geist sans; the serif direction was rejected again, Outfit (a sans display) was chosen instead.
- [x] Typography: added `--font-outfit` in `app/layout.tsx` (replacing the stale "Removed Newsreader" comment), mapped `fontFamily.display` to it in `tailwind.config.ts`, applied `font-display` to the hero heading and "What you get" header in `app/page.tsx`. Outfit serves no italic, so the hero accent uses `font-bold` of the same font instead (per the design-taste emphasis rule). -> verify: `npm run build` passes (did)
- [x] Feature cards hover micro-interactions in `app/page.tsx`: `motion.div` card with `whileHover={{ y: -6 }}` spring (stiffness 300, damping 22), gated by `useReducedMotion()`. -> verify: build passes (did)
- [x] Metric cards elevation in `components/SummaryPanel.tsx`: hover border/glow (`hover:border-brand/40 hover:shadow-md`), larger `text-xl tabular-nums` values, icon scale + color transition on group-hover. -> verify: build passes (did)
- [x] Version bumped 1.0.0 -> 1.5.0 in `package.json`. -> verify: build output prints `reviewer-generator@1.5.0` (did)
- [x] Update `notes/ui/anti-ui-slop-review.md` with what changed -> verify: frontmatter `last-updated` bumped (did, see below)

## Verification

- `npm run build` (includes TypeScript check) after each code change.
- `npm test` after all changes.
- Screenshots can be regenerated via `scripts/shot-landing.ts` for a re-scoring pass.

## Related

- [[ui/anti-ui-slop-review|Anti-UI-slop review]]
- [[architecture/overview|Architecture overview]]