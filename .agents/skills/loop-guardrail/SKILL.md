---
name: loop-guardrails
description: Execution-safety rules that detect, prevent, and break infinite or unproductive loops during coding tasks. Use this skill whenever running terminal commands, applying file edits, debugging failing tests, or executing any multi-step fix that could be retried repeatedly. Mandatory before attempting any code edit intended to fix a bug or failing test, and mandatory whenever a command, test, or edit has already failed once. Enforces a 3-retry ceiling, a red-first test validation step, stall diagnostics, and a hard stop requiring human intervention instead of speculative repeated fixes. Trigger this skill any time you notice yourself about to retry something you already tried, rerun a command that already failed, or attempt "one more" fix without a new hypothesis.
---

# Loop Guardrails

Guardrails that stop an agent from burning time, tokens, or trust by repeating
the same failing action. This skill is not optional guidance — it is a hard
constraint on execution. If any rule below conflicts with the impulse to "try
one more thing," the rule wins.

## Core Principle

**A repeated action without a new hypothesis is not debugging — it is a loop.**

Before re-running any command or re-editing any file after a failure, you must
be able to state, in one sentence, *what specifically changed* about your
understanding of the problem since the last attempt. If you cannot state that
sentence, you are not allowed to retry. You must stop instead (see
"Escalation Protocol").

## Rule 1 — The 3-Retry Ceiling

Any single failing terminal command or file modification gets a **maximum of
3 attempts** before execution must halt and escalate.

- **Attempt 1**: Run the command / apply the edit as originally planned.
- **Attempt 2**: Only after forming a distinct hypothesis for why Attempt 1
  failed (different root cause, not a cosmetic variation of the same fix).
- **Attempt 3**: Only after Attempt 2's hypothesis is also falsified, with a
  new, distinct hypothesis for Attempt 3.
- **After Attempt 3 fails**: STOP. Do not attempt a 4th variation. Proceed
  directly to the Escalation Protocol.

Rules for what counts as a "distinct" attempt vs. a disguised repeat:
- Changing a variable name, log statement, or comment while leaving the
  underlying logic identical is **not** a new attempt — it's the same attempt
  restated. It does not consume a retry slot productively; it fails
  immediately and should be treated as a wasted attempt.
- Re-running the exact same command hoping for a different result (flaky test
  chasing, network retries, timing hopes) counts toward the ceiling every
  time, with no exceptions for "maybe it'll pass this time."
- Each retry must be logged (see "Retry Log" below) with its hypothesis
  *before* execution, not rationalized after the fact.

### Retry Log

Maintain a running, visible log for the current failing task. Before each
retry, append an entry. This log is what gets handed to the user if
escalation is triggered.

```
Attempt 1: [what was tried] → [what happened]
Hypothesis for Attempt 2: [specific, falsifiable reason this will differ]
Attempt 2: [what was tried] → [what happened]
Hypothesis for Attempt 3: [specific, falsifiable reason this will differ]
Attempt 3: [what was tried] → [what happened]
```

If you cannot fill in a "Hypothesis" line with something more specific than
"try again" or "maybe this will work," do not take the attempt. Escalate
instead.

## Rule 2 — Red-First Validation (Mandatory Before Any Fix)

Never edit code to fix a bug or failing behavior without first **proving the
failure exists in a controlled, reproducible way**. This is non-negotiable
and comes before Rule 1's retry counter even starts.

Sequence, in order:

1. **Reproduce red.** Run the relevant test (or write a minimal one if none
   exists) and confirm it fails for the reason you believe it fails. Capture
   the actual error output — do not paraphrase or assume it from memory of
   similar bugs.
2. **State the hypothesis.** In one or two sentences, state what you believe
   is broken and why the red output supports that belief.
3. **Make the smallest edit that addresses the stated hypothesis.** Do not
   bundle unrelated changes into the same edit — bundled edits make it
   impossible to know which change fixed (or broke) anything, which directly
   feeds future loops.
4. **Re-run the same test to confirm green.** The test that was red must now
   be the test you check — do not substitute a different, easier test as
   evidence of success.
5. **If still red**, this is a retry under Rule 1's ceiling — log it, form a
   new hypothesis, and proceed accordingly.

Skipping straight to an edit because a fix "seems obviously right" is
explicitly disallowed. Confidence is not a substitute for a red test. If no
test framework exists in the project, construct the smallest possible manual
reproduction (a script, a REPL command, a curl call) and treat its failing
output as the red state.

## Rule 3 — Stall Detection and Diagnostic Breakdown

A "stall" is any of the following:
- The same error message (or class of error) appears on two consecutive
  attempts despite different fixes.
- No measurable progress indicator has changed across 2 attempts (same test
  count failing, same compiler error line, same crash signature).
- The agent notices it is about to suggest an approach it already tried
  earlier in the session, even if phrased differently.
- More than 3 consecutive tool calls have been spent on the same failing
  target with no new information gained.

When a stall is detected, **stop attempting fixes immediately** and produce a
Diagnostic Breakdown instead of another edit. The breakdown must include:

```
## Diagnostic Breakdown

**Task:** [what was being attempted]
**Symptom:** [the exact, current failure — error text, test name, behavior]
**Attempts so far:** [reference the Retry Log]
**What is confirmed:** [facts established with certainty, e.g. "the function
  is being called with the right arguments," "the config file is being read"]
**What is NOT yet confirmed / suspected:** [open questions, competing
  theories, things that could not be verified]
**Why this looks like a stall:** [the specific repeated signal — same error
  twice, no metric moved, etc.]
**Possible next directions (not yet attempted):** [list 2-4 concrete,
  genuinely different approaches — not variations of what failed]
```

This breakdown is a deliverable, not internal scratch work — it should be
shown to the user even if they haven't asked for a status update.

## Rule 4 — Escalation Protocol (Human Intervention)

Escalate to the user instead of continuing to iterate when **any** of the
following occurs:

- The 3-retry ceiling (Rule 1) is reached for a given failure.
- A stall (Rule 3) is detected.
- The fix under consideration would touch a system the agent was not
  explicitly asked to modify (e.g., editing CI config, infra, or auth logic
  to "just make the test pass").
- The proposed next step is speculative — meaning it's based on a guess
  about behavior the agent has not actually observed (e.g., "maybe it's a
  caching issue" without having checked for a cache).
- Undoing or reverting the current change entirely seems like it might be
  necessary — that decision belongs to the user, not the agent.

**When escalating, do not just say "I'm stuck."** Provide:

1. The Diagnostic Breakdown (Rule 3 format), even if a formal stall wasn't
   detected — it's the same structure and gives the user everything needed
   to decide.
2. A direct, specific question or decision point for the user — not an
   open-ended "what should I do?" Examples of the right shape:
   - "Attempts 1-3 all assumed the bug is in `parseConfig`. I now suspect the
     input file itself is malformed upstream of this code. Do you want me to
     inspect the file generation step, or is that out of scope?"
   - "The test expects behavior X, but the spec doc says Y. These conflict —
     which one is correct?"
3. An explicit statement that you have stopped making changes and are
   waiting for input. Do not continue editing files while waiting.

**Never** respond to a stall or retry-ceiling event by silently trying a 4th,
5th, or 6th variation, by broadening the scope of the fix without asking, or
by declaring success on a weaker/different test than the one that was
originally red.

## Quick Reference

| Situation | Required action |
|---|---|
| About to edit code to fix a bug | Confirm red test exists first (Rule 2) |
| A command/edit just failed | Log the attempt; form a distinct hypothesis before retrying (Rule 1) |
| Same failure signature twice in a row | Stop. Produce Diagnostic Breakdown (Rule 3) |
| 3 attempts exhausted on one failure | Stop. Escalate to user (Rule 4) |
| About to touch out-of-scope systems to force a pass | Stop. Escalate to user (Rule 4) |
| Can't state a new hypothesis for the next attempt | Do not retry. Escalate (Rule 4) |

## Anti-Patterns to Actively Refuse

- Re-running an identical command expecting a different result.
- Adding `try/except` (or equivalent) around a failure to silence it instead
  of understanding it.
- Deleting or skipping a failing test to "unblock" progress.
- Making increasingly broad, unrelated changes hoping one of them sticks.
- Declaring victory because *a* test passes, without confirming it's the
  *same* test that was originally red.
- Continuing to iterate silently for many turns without surfacing a
  Diagnostic Breakdown to the user.
