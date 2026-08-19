---
created: 2026-08-19
last-updated: 2026-08-19
status: verified
---

# ReviewerGenerator — Knowledge Vault

This folder is the project's AI-maintained long-term memory, treated as an Obsidian vault. It exists to preserve architecture knowledge, design decisions, known issues, and TODOs across sessions so future work doesn't repeat prior reasoning or contradict earlier decisions.

> [!note] Entry point
> Start at [[index]] — it lists every top-level folder with a one-line description and a wikilink.

## How to use this vault

- **Before starting a task**, check the relevant folder here for existing context (architecture, past decisions, known issues).
- **After any non-trivial change** (feature, bug fix, architecture decision, dependency change), create or update the matching note — record *why* as well as *what*.
- Don't log trivial changes (typos, formatting). Only log what future work would genuinely benefit from knowing.
- Never store real secrets here. If a credential is needed, describe it (e.g. "requires `GEMINI_API_KEY`, stored in `.env.local`") without the value.

## Folder guide

| Folder | Contents |
|--------|----------|
| `notes/architecture/` | How the app is built and how data flows |
| `notes/decisions/` | Decisions implied by the code and their reasoning |
| `notes/known-issues/` | Dead code, code smells, and technical debt |
| `notes/tasks/` | Outstanding work / TODOs |

See [[index]] for the full, up-to-date list.

## Note conventions

- YAML frontmatter on every note: `created`, `last-updated`, `status` (`draft` / `verified`).
- Obsidian `[[wikilinks]]` to cross-reference related notes.
- `> [!note]` / `> [!warning]` callouts for important context.
- Outdated notes are marked deprecated with a callout, never silently deleted.

## Project at a glance

A Next.js 16 single-page app that turns uploaded study documents (PDF/DOCX/TXT) into an AI-generated or offline-built study guide ("reviewer") with summary, topics, terms, facts, flashcards, quiz, concept map, and AI tutor. See [[architecture/overview]] for details.
