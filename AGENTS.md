# Project Memory & Skill Usage Rules

## Codebase Scope

This project's language/stack may vary or change over time — apply these rules based on what you actually find, not a fixed list.

**General rule:** ignore any folder that is auto-generated, a dependency cache, or a build output, regardless of language. You can usually recognize these by:
- They're listed in `.gitignore`
- They contain a huge number of files you didn't write (thousands of small files, minified code, compiled binaries)
- They can be regenerated from a manifest file (`package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, `*.csproj`, `Gemfile`, `composer.json`, etc.) — the manifest is what matters, not the generated contents

**Common examples across ecosystems** (not exhaustive — apply the general rule above to anything not listed here):
- **JavaScript/TypeScript/Node:** `node_modules/`, `.next/`, `dist/`, `build/`, `out/`, `.turbo/`, `.cache/`
- **Python:** `venv/`, `.venv/`, `__pycache__/`, `*.egg-info/`, `.pytest_cache/`, `.mypy_cache/`
- **Rust:** `target/`
- **Go:** `vendor/`
- **Java/Kotlin:** `target/`, `.gradle/`, `build/`
- **.NET/C#:** `bin/`, `obj/`
- **Ruby:** `vendor/bundle/`, `.bundle/`
- **PHP:** `vendor/`
- **General:** `.git/`, `.svn/`, any `logs/` or `tmp/` folder full of runtime output

**Lockfiles** (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `Cargo.lock`, `poetry.lock`, `Gemfile.lock`, etc.) — their *existence* matters (confirms what's installed), but do not read their full contents; they add no useful context and burn tokens.

Only look inside any of the above if the task explicitly requires debugging a build artifact, dependency version conflict, or similar — otherwise treat them as opaque and skip them entirely.

### Secrets and sensitive files

- **Never read the contents of `.env`, `.env.local`, or any other environment/secrets file into a note, a chat response, or anywhere else**, unless the user explicitly asks you to work with one directly. `.env.*.example` files (with placeholder values, no real secrets) are safe to read normally.
- **Never write real API keys, tokens, passwords, connection strings, or other credentials into `notes/`**, even if you saw them while working. If a note needs to reference that a credential exists, describe it (e.g. "requires a Stripe secret key, stored in `.env.local`") without including the actual value.
- If you notice a real secret committed somewhere it shouldn't be (e.g. hardcoded in a source file instead of an env var), flag it to the user — don't just quietly fix or ignore it.

## Persistent Memory (Obsidian Vault)

This project uses a folder named `notes/` as a persistent Obsidian vault — treat it as your long-term memory for this project, not just a folder.

- **If `notes/` does not exist yet, create it** before doing anything else, along with a `notes/README.md` explaining it's the project's AI-maintained knowledge base.
- **Before starting any task**, check `notes/` for existing relevant context (architecture notes, past decisions, known issues) so you don't repeat prior work or contradict earlier decisions.
- **After completing any non-trivial task** — a new feature, a bug fix, a refactor, an architecture or design decision, a dependency change, or anything that changes how part of the project works or is structured — update or create the relevant note in `notes/` reflecting what changed and why, not just what the code now does but the reasoning behind it.
- **Do not create a new note for purely cosmetic changes** (typo fixes, formatting, whitespace, renaming a variable with no behavior change). If you're unsure whether something counts as trivial or non-trivial, treat it as non-trivial — a redundant note is a much smaller cost than losing context.

### Obsidian syntax reference

Use this syntax correctly both when writing new notes and when reading existing ones — don't treat it as plain text in either direction.

- `[[Note Name]]` — a link to another note in `notes/`. When writing, use this to cross-reference related notes. When reading, treat it as a pointer and follow it if the linked note is relevant to the current task.
- `[[Note Name|Display Text]]` — links to `Note Name` but displays `Display Text`. The link target is what matters, not the display text.
- `![[Note Name]]` — embeds another note's content inline. When reading, treat it as if that note's content is included at that point.
- `> [!note]`, `> [!warning]`, `> [!danger]`, etc. — callouts. Use the type that matches the content's importance when writing; when reading, don't skim past warning/danger callouts as if they were regular text.
- YAML frontmatter (the `---` block at the top of a note) — see the metadata rules under Long-Term Memory Hygiene below for what to include and how to interpret it.

### Folder organization inside notes/

- **Before creating a new note, check if a folder already exists for that topic.** If yes, put the note there instead of creating a new folder or a duplicate at the root.
- **If no matching folder exists, create one** with a short, clear, lowercase, hyphenated name that describes the topic (e.g. `notes/architecture/`, `notes/bugs/`, `notes/api-design/`). Do not put loose topical notes directly at the root of `notes/` — every note should live inside a folder for its subject.
- **Before creating a new folder, double-check similarly-named folders don't already exist** (e.g. don't create `notes/architecture/` if `notes/codebase-overview/` already covers the same thing) — reuse the existing one instead.
- If you're unsure whether something fits an existing folder or needs a new one, prefer reusing the closest existing folder over creating a new one.

### When an existing note grows too large

- **Before adding to an existing note, check its rough size.** If it's already large (as a guideline: past ~200-300 lines, or clearly covering more than one distinct sub-topic), don't just keep appending — split it instead.
- **To split a note:** turn it into a small folder of its own (e.g. `quiz.md` becomes `quiz/overview.md`, `quiz/scoring.md`, `quiz/answer-review.md`, matching the sub-topics already in the file), and leave a short summary note in the original location that links out to each split file via `[[wikilinks]]`.
- **When adding new content to a note that's still a reasonable size**, keep doing what already works well: add a clearly dated/named section (e.g. `## Answer review (added <date>)`) rather than rewriting the whole file — this preserves history and keeps diffs easy to follow.
- The goal is that no single note becomes so large that re-reading it wastes significant context or makes the topic hard to scan — split by sub-topic, not by arbitrary size alone.

## Skill Usage

This project may have installed skills (SKILL.md files, typically under `.agents/skills/`, `.claude/skills/`, or `.opencode/skills/`).

- **Before starting a task, check if an installed skill matches it.** If one exists, use it rather than improvising the same capability from scratch.
- **Always check for and read a relevant skill before fixing, creating, modifying, auditing, reviewing, or doing anything else** — regardless of how the task is phrased. A matching skill takes priority over relying on general knowledge alone.
- If no skill exists for a recurring type of task you're doing often, mention to the user that creating one could help next time — don't create skills unprompted.

## Long-Term Memory Hygiene

`notes/` will grow over many sessions. Follow these rules so it stays organized and trustworthy instead of turning into clutter.

**1. Maintain a single index note.**
Keep one file at `notes/index.md` that lists every top-level folder in `notes/`, each with a one-line description and a `[[wikilink]]` to it. Whenever you create a new top-level folder, add an entry for it in `notes/index.md` in the same task — do not leave the index out of date. This file is the entry point for understanding the whole memory structure at a glance.

**2. Add metadata to every note you write.**
At the top of every note, include YAML frontmatter with at least:
```yaml
---
created: <date you created it>
last-updated: <date of most recent edit>
status: draft | verified
---
```
Update `last-updated` any time you revise a note, not only when creating it. This lets anyone later find notes that haven't been touched in a long time and may be outdated. Check `status: draft` vs `status: verified` before treating a note's content as settled fact — prefer verified notes when they conflict with draft ones.

**Notes created before this rule existed may have no frontmatter at all.** Treat those as equivalent to `status: draft` (useful context, but not guaranteed current or reviewed) rather than ignoring them. When you next update one of these older notes for an unrelated reason, add proper frontmatter to it at the same time.

**3. Periodically review and clean up.**
Roughly every 10–15 sessions, or whenever the user asks you to, review `notes/` for duplicate or overlapping notes/folders and merge them. If you notice duplication while doing an unrelated task, flag it to the user rather than silently ignoring it.

**4. Never silently delete outdated information — mark it as historical instead.**
When something in `notes/` becomes outdated (e.g. an architecture decision that was later reversed), do not delete the note. Instead, add a callout at the top of the note explaining it's outdated and why, for example:
```markdown
> [!warning] Deprecated
> This approach was replaced on <date>. See [[new-note-name]] for the current approach.
```
This preserves the reasoning history so past decisions aren't lost, which matters most for anything in a `decisions`-type folder.

## Verification Before Claiming Success

- **After making any code change, run the project's actual build/test/lint command** (check `package.json` scripts, a `Makefile`, or similar for the right one) **before telling the user the task is complete.**
- **If the build or tests fail, do not report success.** Either fix the failure and re-verify, or clearly tell the user it failed and what the error was — never say something like "all checks passed" without having actually run and confirmed that.
- If there's no build/test command available for this project, say so explicitly rather than implying verification happened when it didn't.
- **At the end of every response where you changed code, explicitly state whether you updated `notes/` and which file** — e.g. "Updated notes/features/quiz-answers.md" or "No notes/ update needed (trivial change)." Never end a non-trivial task silently without this line — it's how the user can verify the memory rule actually ran, instead of trusting it happened invisibly.

## Notes for Claude Code specifically

If you are Claude Code and this file wasn't loaded automatically, read `@AGENTS.md` now — this file is the source of truth for project conventions and memory handling.
