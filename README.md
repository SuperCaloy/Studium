# Reviewer Generator

Upload PDFs, DOCX, or TXT files and get a generated study guide: an executive
summary, key terms, topic breakdowns, a concept map, and a quiz with AI
explanations. AI generation runs on the server (LLM keys never reach the
browser); if no keys are configured or the AI fails, a deterministic offline
engine produces the same structure from the source text.

Built with Next.js (App Router, streaming SSE), React, Tailwind CSS, and
TypeScript.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Environment

Copy `.env.example` to `.env.local` and add at least one LLM provider key.
Supported providers (tried in this order):

- Gemini — `GEMINI_API_KEY` (up to 5 keys supported via `_2`…`_5` suffixes for
  automatic rotation)
- Groq — `GROQ_API_KEY`
- OpenRouter — `OPENROUTER_API_KEY`
- Mistral — `MISTRAL_API_KEY`

Optional per-provider model overrides: `GEMINI_MODEL`, `GROQ_MODEL`,
`OPENROUTER_MODEL`, `MISTRAL_MODEL`. All keys are read server-side only.

Optional rate-limit store: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
enable a shared sliding-window limiter; without them a per-instance in-memory
limiter is used (15 req/min per client IP).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (includes TypeScript check) |
| `npm start` | Run the production build |
| `npm test` | Run the Vitest suite (`__tests__/`) |
| `npm run lint` | (Broken — `next lint` was removed in Next.js 16; needs an ESLint config) |

## How it works

- **`/api/generate`** — POST (streaming, SSE). Uploaded text is chunked and
  sent to the LLM, which streams back topics/terms as they complete; a
  procedural quiz is merged with the AI quiz. Ungrounded AI questions (those
  citing numbers/formulas absent from the source) are swapped with grounded
  offline questions. On any AI failure a complete offline reviewer is streamed
  instead.
- **`/api/explain`** — explains a quiz answer via the fastest available
  provider.
- **`/api/tutor`** — chat grounded in the generated reviewer.
- **Offline engine** — deterministic NLP generation (term extraction, topic
  synthesis, concept map, quiz) that needs no LLM keys.

The client persists documents and the single active reviewer in IndexedDB /
localStorage; nothing user-generated is stored server-side.

## Architecture notes

The `notes/` folder is an Obsidian vault that documents the architecture and
the reasoning behind decisions (AI provider failover, grounding verification,
schema versioning, PDF export strategy, security model). `notes/index.md` is
the entry point.

## Deployment

Serverless-friendly (Vercel recommended): all routes are dynamic and there is
no database requirement. `runtime = "nodejs"` is used on `/api/generate` with a
60s `maxDuration`. For rate limiting across instances, configure Upstash.

## Tests

`__tests__/` uses Vitest (Node environment, no DOM). It covers the offline
engine, AI-parsing sanitization, API guard helpers, schema migration, and
regression tests for fixed bugs.
