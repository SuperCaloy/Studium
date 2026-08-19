---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# Quiz component

`components/Quiz.tsx` — the practice-quiz flow inside the Dashboard. Pure client component; the question bank comes from `reviewer.quizBank` and per-question AI explanations come from `/api/explain`.

## Flow

- **Setup**: user picks a target count (10/20/30/50/70/100, capped at `bank.length`). The target also persists to localStorage `reviewer-target` via `onTargetChange` in `app/page.tsx`.
- **Running**: session = `shuffle(bank).slice(0, target)`. Each question must be revealed (`answers[id] ?? -1` recorded, added to `checked`) before advancing. The last question shows an always-available **Submit** button (B11 fix).
- **Finished**: score screen + full answer review.

## Answer review (added 2026-08-19)

The summary shows **every** session question with the user's answer and the correct answer side by side, plus a filter (`All | Missed | Correct`), the question explanation, and a per-question "Ask AI Tutor to explain why" (reuses the running-view `handleExplain`).

- `answers` is `Record<questionId, optionIndex>`; `-1` = skipped via reveal, `undefined` = never answered (e.g. submitting the last question without revealing). Both render as "Skipped / Not answered".
- **Scoring**: `correct` counts `answers[q.id] === q.correctAnswerIndex` (any answered-correct question, revealed or not). It no longer requires `checked` — so a correct answer submitted without revealing still scores. Skips never count (`-1` ≠ any real index). This keeps the score consistent with the review list.

## Why the review is in-memory

The quiz session is ephemeral and resets on Retake; the reviewer itself is persisted ([[architecture/persistence]]), but a completed attempt's answers are deliberately not stored.
