import type {
  ExtractedDocument,
  Fact,
  ReviewerData,
  TermDefinition,
  TopicAccordion,
  ConceptMapData,
  TopicDetail,
} from "./types";
import { REVIEWER_SCHEMA_VERSION } from "./types";
import { normalizeIds } from "./reviewer-generator";
import type { SourceDraft } from "./reviewer-generator";

export interface ProviderKeys {
  gemini?: string[];
  groq?: string[];
  openrouter?: string[];
  mistral?: string[];
  sambanova?: string[];
}

export interface ProviderConfig {
  id: keyof ProviderKeys;
  name: string;
  kind: "gemini" | "openai";
  baseUrl?: string;
  models: string[];
  maxOutputTokens: number;
  timeoutMs: number;
  topicCap: number;
  termCap: number;
}

const MAX_CONTEXT_CHARS = 40000;
const MAX_DOC_CHARS = 12000;

export const PROVIDERS = [
  {
    id: "mistral",
    name: "Mistral",
    kind: "openai",
    baseUrl: "https://api.mistral.ai/v1/chat/completions",
    models: ["mistral-small-latest", "open-mistral-nemo"],
    maxOutputTokens: 8192,
    timeoutMs: 60000,
    topicCap: 20,
    termCap: 100,
  },
  {
    id: "gemini",
    name: "Gemini",
    kind: "gemini",
    models: ["gemini-3.5-flash"],
    maxOutputTokens: 16000,
    timeoutMs: 120000,
    topicCap: 60,
    termCap: 400,
  },
  {
    id: "groq",
    name: "Groq",
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    maxOutputTokens: 4096,
    timeoutMs: 45000,
    topicCap: 20,
    termCap: 100,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    models: ["openrouter/free"],
    maxOutputTokens: 8192,
    timeoutMs: 60000,
    topicCap: 20,
    termCap: 100,
  },
  {
    id: "sambanova",
    name: "SambaNova",
    kind: "openai",
    baseUrl: "https://api.sambanova.ai/v1/chat/completions",
    models: ["Meta-Llama-3.3-70B-Instruct"],
    maxOutputTokens: 4096,
    timeoutMs: 45000,
    topicCap: 20,
    termCap: 100,
  },
] satisfies ProviderConfig[];

interface ShardParts {
  title?: string;
  overview?: string;
  keyTakeaways?: string[];
  topics?: TopicAccordion[];
  terms?: TermDefinition[];
  conceptMap?: ConceptMapData;
}

interface TaskResult<T> {
  value: T;
  provider: string;
  model: string;
}

const TOPICS_SCHEMA = `{
  "title": "string",
  "overview": "string",
  "keyTakeaways": ["string"],
  "topics": [{ "title": "string", "summary": "string", "details": [{ "heading": "string", "points": ["string"] }] }],
  "conceptMap": { "isNeeded": true, "mappings": [["Source Concept", "relationship label", "Target Concept"]] }
}`;

const TERMS_SCHEMA = `{
  "terms": [{ "term": "string", "definition": "string", "sourceDoc": "string" }]
}`;

function stripCodeFence(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    const firstNewline = t.indexOf("\n");
    if (firstNewline !== -1) t = t.slice(firstNewline + 1);
    if (t.endsWith("```")) t = t.slice(0, -3);
  }
  return t.trim();
}

function extractBalancedObjects(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        out.push(s.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

function salvageJson(raw: string, arrayKey: string): unknown {
  const cleaned = stripCodeFence(raw).slice(0, 500000);
  try {
    return JSON.parse(cleaned);
  } catch {
    // truncated output — recover every complete object
  }
  const parsed = extractBalancedObjects(cleaned)
    .map((o) => {
      try {
        return JSON.parse(o);
      } catch {
        return null;
      }
    })
    .filter(
      (x): x is Record<string, unknown> =>
        x !== null && typeof x === "object" && !Array.isArray(x)
    );
  if (parsed.length === 1 && Array.isArray(parsed[0][arrayKey])) {
    return parsed[0];
  }
  return { [arrayKey]: parsed };
}

function parseTopicsPart(raw: string): ShardParts {
  const p = salvageJson(raw, "topics") as ShardParts;
  if (typeof p !== "object" || p === null)
    throw new Error("The model returned a malformed topics response.");
  if (!Array.isArray(p.topics) || p.topics.length === 0)
    throw new Error("The model returned no topics.");
  return p;
}

function parseTermsPart(raw: string): ShardParts {
  const p = salvageJson(raw, "terms") as ShardParts;
  if (typeof p !== "object" || p === null)
    throw new Error("The model returned a malformed terms response.");
  if (!Array.isArray(p.terms) || p.terms.length === 0)
    throw new Error("The model returned no terms.");
  return p;
}

function buildTopicsPrompt(topicCap: number): string {
  return `Extract info ONLY from provided docs. Ground every claim. Output JSON only. Tone must be highly professional and academic.

Rules:
1. Ignore citations, bibliographies, URLs, boilerplate, table of contents.
2. Synthesize & Compress: Output must be dense. No meta-language ("This covers").
3. No raw code: Translate to standard math/logic notation.
4. NEVER use em-dashes (—). Use normal hyphens or colons instead.
5. title: Meaningful subject heading (not course code/school name).
6. overview: 2-3 sentence summary.
7. keyTakeaways: 5-8 factual takeaways.
8. topics: Every major section (up to ${topicCap}). Title, 1-sentence summary, details (heading+points).
9. conceptMap: Map complex relational concepts. "mappings": [["Concept A", "relation", "Concept B"]]. Max 15 mappings. If simple list, "isNeeded": false.
10. No placeholders or ellipses. Keep it high-value, skip filler.
11. Draft may be provided. Verify against source text.`;
}

function buildTermsPrompt(termCap: number): string {
  return `Extract terms & definitions ONLY from provided docs. Output JSON only. Tone must be highly professional and academic.

Rules:
1. Ignore citations, boilerplate, table of contents.
2. NEVER use em-dashes (—). Use normal hyphens or colons instead.
3. terms: Glossary of key terms (up to ${termCap}). Include 'sourceDoc'.
4. Definitions must be complete, grammatically correct sentences (e.g. "Photosynthesis is the process...", not "Photosynthesis process..."). 1-2 sentences max (<30 words). Cut filler.
5. No placeholders or ellipses.
6. Draft may be provided. Verify against source text.`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((s) => s.length > 0);
}

// AI models sometimes omit fields or emit null/empty entries. Normalize every
// topic/term to its expected shape so downstream consumers (quiz builder, PDF,
// markdown) never read properties of undefined.
function sanitizeParts(parts: ShardParts): ShardParts {
  const sanitized: ShardParts = {
    title: asString(parts.title) || undefined,
    overview: asString(parts.overview) || undefined,
    keyTakeaways: asStringArray(parts.keyTakeaways),
  };

  const topics = Array.isArray(parts.topics)
    ? (parts.topics as unknown[])
      .filter((t): t is Record<string, unknown> =>
        Boolean(t) && typeof t === "object" && !Array.isArray(t)
      )
      .map((t) => {
        const title = asString(t.title);
        const summary = asString(t.summary);
        const id = typeof t.id === "string" && t.id ? t.id : undefined;
        const details = Array.isArray(t.details)
          ? (t.details as unknown[])
            .filter((d): d is Record<string, unknown> =>
              Boolean(d) && typeof d === "object" && !Array.isArray(d)
            )
            .map((d) => {
              const heading = asString(d.heading);
              const points = asStringArray(d.points);
              const did = typeof d.id === "string" && d.id ? d.id : undefined;
              if (!heading || points.length === 0) return null;
              return { id: did, heading, points } as TopicDetail;
            })
            .filter((d): d is TopicDetail => d !== null)
          : [];
        if (!title) return null;
        return { id, title, summary, details } as TopicAccordion;
      })
      .filter((t): t is TopicAccordion => t !== null)
    : [];

  const terms = Array.isArray(parts.terms)
    ? (parts.terms as unknown[])
      .filter((t): t is Record<string, unknown> =>
        Boolean(t) && typeof t === "object" && !Array.isArray(t)
      )
      .map((t) => {
        const term = asString(t.term);
        const definition = asString(t.definition);
        if (!term || !definition) return null;
        return {
          id: typeof t.id === "string" && t.id ? t.id : undefined,
          term,
          definition,
          sourceDoc: asString(t.sourceDoc) || undefined,
        } as TermDefinition;
      })
      .filter((t): t is TermDefinition => t !== null)
    : [];

  if (topics.length > 0) sanitized.topics = topics;
  if (terms.length > 0) sanitized.terms = terms;
  return sanitized;
}

export function assembleReviewer(
  docs: ExtractedDocument[],
  parts: ShardParts,
  draft?: SourceDraft,
  facts: Fact[] = []
): ReviewerData {
  const totalWords = docs.reduce((s, d) => s + d.wordCount, 0);
  const clean = sanitizeParts(parts);
  const { topics, terms } = normalizeIds(
    (clean.topics && clean.topics.length > 0
      ? clean.topics
      : draft?.topics ?? []
    ).slice(0, 60),
    (clean.terms && clean.terms.length > 0
      ? clean.terms
      : draft?.terms ?? []
    ).slice(0, 400)
  );
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    summary: {
      title: clean.title || draft?.title || "Study Reviewer",
      overview: clean.overview || draft?.overview || "",
      keyTakeaways:
        clean.keyTakeaways && clean.keyTakeaways.length > 0
          ? clean.keyTakeaways
          : (draft?.keyTakeaways ?? []).map((t) => asString(t)).filter(Boolean),
      docCount: docs.length,
      totalPages: docs.reduce((s, d) => s + (d.pageCount || 1), 0),
      totalWords,
      targetStudyMinutes: Math.max(5, Math.ceil(totalWords / 200)),
    },
    topics,
    terms,
    conceptMap: parts.conceptMap,
    facts,
    quizBank: [],
    engine: "ai",
    version: REVIEWER_SCHEMA_VERSION,
  };
}

interface TaskPreference {
  providerId: string;
  keyIndex: number;
}

const PROVIDER_ORDER = PROVIDERS.map((p) => p.id);

// Rotates which provider leads each task across requests so generation is
// not always Mistral. The offset advances on every generateCards call.
let rotationOffset = 0;

export function preferredFor(
  taskIndex: number,
  available: string[]
): TaskPreference {
  if (available.includes("gemini")) {
    return { providerId: "gemini", keyIndex: taskIndex + rotationOffset };
  }
  const pool = available.length > 0 ? available : PROVIDER_ORDER;
  const providerId = pool[(taskIndex + rotationOffset) % pool.length];
  return { providerId, keyIndex: 0 };
}

async function runTask<T>(
  taskLabel: string,
  keys: ProviderKeys,
  modelOverrides: Partial<Record<keyof ProviderKeys, string>> | undefined,
  preference: TaskPreference | null,
  build: (provider: ProviderConfig) => {
    systemPrompt: string;
    schema: string;
  },
  parse: (raw: string) => T,
  userContent: string,
  failures: string[]
): Promise<TaskResult<T> | null> {
  const order: ProviderConfig[] = preference
    ? [
      ...PROVIDERS.filter((p) => p.id === preference.providerId),
      ...PROVIDERS.filter((p) => p.id !== preference.providerId),
    ]
    : PROVIDERS;
  for (const provider of order) {
    const apiKeys = keys[provider.id];
    if (!apiKeys || apiKeys.length === 0) continue;
    const override = modelOverrides?.[provider.id]?.trim();
    const models = override ? [override] : provider.models;
    const { systemPrompt, schema } = build(provider);
    const startKey =
      preference && provider.id === preference.providerId
        ? preference.keyIndex % apiKeys.length
        : 0;
    for (let count = 0; count < apiKeys.length; count++) {
      const ki = (startKey + count) % apiKeys.length;
      for (const model of models) {
        try {
          const raw = await callWith429Retry(
            provider,
            apiKeys[ki],
            model,
            systemPrompt,
            userContent,
            schema
          );
          const value = parse(stripCodeFence(raw));
          console.log(
            `[shard] task=${taskLabel} provider=${provider.name} key=${ki} model=${model}`
          );
          return { value, provider: provider.name, model };
        } catch (err) {
          failures.push(
            `${taskLabel}:${provider.name}[key ${ki}] ${model} (${err instanceof Error ? err.message : "unknown error"
            })`
          );
        }
      }
    }
  }
  return null;
}

async function callWith429Retry(
  provider: ProviderConfig,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string,
  jsonSchema: string
): Promise<string> {
  try {
    return await callProvider(
      provider,
      apiKey,
      model,
      systemPrompt,
      userContent,
      jsonSchema
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/HTTP 429|429|rate.?(limit|exceeded)|quota/i.test(msg)) {
      await new Promise((r) => setTimeout(r, 1500));
      return callProvider(
        provider,
        apiKey,
        model,
        systemPrompt,
        userContent,
        jsonSchema
      );
    }
    throw err;
  }
}

export async function callProvider(
  provider: ProviderConfig,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string,
  jsonSchema: string
): Promise<string> {
  return provider.kind === "gemini"
    ? callGemini(
      apiKey,
      model,
      systemPrompt,
      userContent,
      jsonSchema,
      provider.maxOutputTokens,
      provider.timeoutMs
    )
    : callOpenAICompat(
      apiKey,
      provider.baseUrl!,
      model,
      systemPrompt,
      userContent,
      jsonSchema,
      provider.maxOutputTokens,
      provider.timeoutMs
    );
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string,
  jsonSchema: string,
  maxOutputTokens: number,
  timeoutMs: number
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [
      {
        parts: [
          {
            text: `Input documents:\n\n${userContent}\n\nRequired JSON shape:\n${jsonSchema}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens,
      responseMimeType: "application/json",
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(
      `Gemini API error (HTTP ${res.status}): ${bodyText.slice(0, 200)}`
    );
  }
  const data = await res.json();
  const candidates = data.candidates ?? [];
  const text =
    candidates[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") ?? "";
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

async function callOpenAICompat(
  apiKey: string,
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userContent: string,
  jsonSchema: string,
  maxOutputTokens: number,
  timeoutMs: number
): Promise<string> {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: maxOutputTokens,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Input documents:\n\n${userContent}\n\nRequired JSON shape:\n${jsonSchema}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(
      `Provider API error (HTTP ${res.status}): ${bodyText.slice(0, 200)}`
    );
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Provider returned an empty response.");
  return content;
}

export interface CardsResult {
  reviewer: ReviewerData;
}

export function stripCodeBlocks(text: string): string {
  // Cheap regex pre-filter as a cost optimization before LLM
  return text.replace(/```[\s\S]*?```/g, (match) => {
    if (match.length > 300) {
      return "```\n[Code block omitted for cost optimization - assume standard implementation]\n```";
    }
    return match;
  });
}

export function condenseDoc(doc: ExtractedDocument): string {
  let text = stripCodeBlocks(doc.text);
  const lines = text.split(/\r?\n/);
  if (lines.length <= 150) return text;

  const chunks: { heading: string; lines: string[] }[] = [];
  let currentHeading = "Document Start";
  let currentLines: string[] = [];

  for (const line of lines) {
    // Hierarchy chunking by markdown headers or numeric sections
    if (/^(#{1,4}\s+|(\d+\.)+\s+[A-Z])/.test(line.trim())) {
      if (currentLines.length > 0) {
        chunks.push({ heading: currentHeading, lines: currentLines });
      }
      currentHeading = line.trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0) {
    chunks.push({ heading: currentHeading, lines: currentLines });
  }

  // Fallback for headerless docs
  if (chunks.length <= 1) {
    if (lines.length <= 500) return text;
    const kept = lines.slice(0, 250).concat(["\n[... excerpted ...]\n"], lines.slice(-250));
    return kept.join("\n");
  }

  let keptText = "";
  let chars = 0;
  for (const chunk of chunks) {
    const chunkStr = `\n${chunk.heading}\n` + chunk.lines.join("\n");
    if (chars + chunkStr.length < 15000) {
      keptText += chunkStr + "\n";
      chars += chunkStr.length;
    } else {
      const brief = `\n${chunk.heading}\n` + chunk.lines.slice(0, 5).join("\n") + "\n[...]\n";
      keptText += brief;
      chars += brief.length;
    }
  }
  return keptText.trim();
}

function buildUserContent(
  docs: ExtractedDocument[],
  draft?: SourceDraft,
  protectedFacts: string[] = []
): string {
  // Guarantee each doc gets a fair chunk of the 40k max chars
  const charsPerDoc = Math.max(2000, Math.min(MAX_DOC_CHARS, Math.floor(MAX_CONTEXT_CHARS / (docs.length || 1))));
  
  const documentsText = docs
    .map((d) => {
      let text = condenseDoc(d);
      if (text.length > charsPerDoc) {
        text = text.slice(0, charsPerDoc) + "\n[... truncated for length ...]";
      }
      return `--- ${d.name} (${d.format}) ---\n${text}`;
    })
    .join("\n\n");
    
  const draftText =
    draft &&
    `\n\nCandidate draft extracted from the source (verify, correct, or discard as needed):\n${JSON.stringify(draft)}`;
  const factsText =
    protectedFacts.length > 0
      ? `\n\nVERBATIM FACTS extracted from the source. These formulas, equations, units, and constants MUST appear in your output exactly as written - never reword, rearrange, or alter any number or symbol:\n${protectedFacts.join("\n")}`
      : "";
  return `${documentsText}${factsText}${draftText ?? ""}`;
}

export async function generateCards(
  docs: ExtractedDocument[],
  keys: ProviderKeys,
  modelOverrides?: Partial<Record<keyof ProviderKeys, string>>,
  draft?: SourceDraft,
  protectedFacts: string[] = [],
  facts: Fact[] = [],
  onProgress?: (event: string, data: any) => void
): Promise<CardsResult> {
  const userContent = buildUserContent(docs, draft, protectedFacts);
  const startedAt = Date.now();
  const failures: string[] = [];

  // Only rotate among providers that actually have keys configured.
  const available = PROVIDER_ORDER.filter((id) => {
    const ks = keys[id];
    return ks && ks.length > 0;
  });
  // Advance offset for key distribution if Gemini is prioritized
  rotationOffset = (rotationOffset + 1) % 100;

  const preferences: TaskPreference[] = Array.from({ length: 2 }, (_, i) => {
    return preferredFor(i, available);
  });

  const tasks: Promise<TaskResult<ShardParts> | null>[] = [
    runTask(
      "topics",
      keys,
      modelOverrides,
      preferences[0],
      (p) => ({
        systemPrompt: buildTopicsPrompt(p.topicCap),
        schema: TOPICS_SCHEMA,
      }),
      (raw) => {
        const t = parseTopicsPart(raw) as ShardParts;
        if (onProgress) onProgress("topics", t);
        return t;
      },
      userContent,
      failures
    ),
    runTask(
      "terms",
      keys,
      modelOverrides,
      preferences[1],
      (p) => ({
        systemPrompt: buildTermsPrompt(p.termCap),
        schema: TERMS_SCHEMA,
      }),
      (raw) => {
        const t = parseTermsPart(raw) as ShardParts;
        if (onProgress) onProgress("terms", t);
        return t;
      },
      userContent,
      failures
    ),
  ];

  const results = await Promise.all(tasks);
  const topicsResult = results[0];
  const termsResult = results[1];

  if (!topicsResult && !termsResult) {
    throw new Error(
      failures.length > 0
        ? `All AI providers failed: ${failures.join("; ")}`
        : "No AI provider keys configured."
    );
  }

  const parts: ShardParts = {
    ...(topicsResult?.value ?? {}),
    ...(termsResult?.value ?? {}),
  };
  const reviewer = assembleReviewer(docs, parts, draft, facts);
  console.log(
    `[cards] ai ok topics:${topicsResult ? topicsResult.provider : "offline"} terms:${termsResult ? termsResult.provider : "offline"} topics=${reviewer.topics.length} terms=${reviewer.terms.length} ms=${Date.now() - startedAt}`
  );
  return { reviewer };
}
