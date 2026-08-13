import type {
  ExtractedDocument,
  ReviewerData,
  TermDefinition,
  TopicAccordion,
  QuizQuestion,
} from "./types";
import type { SourceDraft } from "./reviewer-generator";
import { buildOfflineQuiz } from "./reviewer-generator";

export interface ProviderKeys {
  gemini?: string[];
  groq?: string[];
  openrouter?: string[];
  mistral?: string[];
}

interface ProviderConfig {
  id: keyof ProviderKeys;
  name: string;
  kind: "gemini" | "openai";
  baseUrl?: string;
  defaultModel: string;
}

const MAX_OUTPUT_TOKENS = 16000;
const MAX_INPUT_CHARS = 60000;
const PROVIDER_TIMEOUT_MS = 45000;

const PROVIDERS: ProviderConfig[] = [
  {
    id: "gemini",
    name: "Gemini",
    kind: "gemini",
    defaultModel: "gemini-3.5-flash",
  },
  {
    id: "groq",
    name: "Groq",
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openrouter/free",
  },
  {
    id: "mistral",
    name: "Mistral",
    kind: "openai",
    baseUrl: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-small-latest",
  },
];

interface GeneratedPayload {
  title: string;
  overview: string;
  keyTakeaways: string[];
  targetStudyMinutes: number;
  topics: TopicAccordion[];
  terms: TermDefinition[];
  quizBank: QuizQuestion[];
}

function stripCodeFence(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    const firstNewline = t.indexOf("\n");
    if (firstNewline !== -1) t = t.slice(firstNewline + 1);
    if (t.endsWith("```")) t = t.slice(0, -3);
  }
  return t.trim();
}

function validatePayload(p: GeneratedPayload): boolean {
  return (
    typeof p === "object" &&
    Array.isArray(p.keyTakeaways) &&
    Array.isArray(p.topics) &&
    Array.isArray(p.terms) &&
    Array.isArray(p.quizBank)
  );
}

function buildSystemPrompt(questionTarget: number): string {
  return `You are an expert study material generator. You extract information ONLY from the provided documents. Never invent facts, definitions, terms, or quiz questions that are not present in the input text. Ground every claim in the source material. Response must be valid JSON only, no markdown fences.

Rules:
1. IGNORE anything that looks like references, citations, bibliographies, ISBNs, URLs, copyright lines, school/logo boilerplate, tables of contents, or pretest/posttest question banks in the source. Do NOT extract terms, topics, or facts from them.
2. NEVER reuse or copy questions that already appear in the source documents. The quiz must contain only freshly-written questions about the material.
3. keyTakeaways: 5-8 concise, factual takeaways drawn strictly from the text.
4. topics: up to 20 major sections. Each topic has a title, a 1-2 sentence summary, and 2-5 details with a heading and bullet points, all from the text.
5. terms: a glossary of the most important terms with definitions lifted/paraphrased from the text. Include the source document filename in sourceDoc.
6. title: pick a meaningful title from the document headings, or the cleaned source filename if headings are generic.
7. quizBank: exactly ${questionTarget} questions total (do not exceed this). Up to 20 may be True/False (type "tf", options ["True", "False"]), the rest must be multiple-choice (type "mcq"). Each MCQ has 4 options and correctAnswerIndex; each True/False has options exactly ["True", "False"] with correctAnswerIndex 0 or 1. Include a brief factual explanation and sourceDoc for every question. Spread difficulty across easy/medium/hard. Questions must be answerable using only the provided text.
8. Never include placeholder text or ellipses like "...".
9. A candidate draft may be provided in the user message. The provided JSON draft is an unverified candidate skeleton. You are free to correct, add to, or completely discard any draft field if it is not directly grounded in the source text. Use it to improve the output, but never copy draft content that is missing from or contradicts the documents.`;
}

function buildJsonSchema(): string {
  return `{
  "title": "string",
  "overview": "string",
  "keyTakeaways": ["string"],
  "targetStudyMinutes": number,
  "topics": [{ "id": "string", "title": "string", "summary": "string", "details": [{ "id": "string", "heading": "string", "points": ["string"] }] }],
  "terms": [{ "id": "string", "term": "string", "definition": "string", "sourceDoc": "string" }],
  "quizBank": [{ "id": number, "type": "mcq" | "tf", "question": "string", "options": ["string", "string", "string", "string"], "correctAnswerIndex": number, "explanation": "string", "sourceDoc": "string", "difficulty": "easy" | "medium" | "hard" }]
}`;
}

function normalizeQuiz(
  parsed: GeneratedPayload,
  questionTarget: number
): QuizQuestion[] {
  const tfLimit = Math.min(20, Math.round(questionTarget * 0.3));
  const mcLimit = questionTarget - tfLimit;
  let tfSeen = 0;
  let mcSeen = 0;
  return (parsed.quizBank ?? [])
    .filter((q) => Array.isArray(q.options) && q.options.length >= 2)
    .map((q, i) => {
      let type: "mcq" | "tf" = q.type === "tf" ? "tf" : "mcq";
      if (type === "tf" && tfSeen >= tfLimit) type = "mcq";
      if (type === "mcq" && mcSeen >= mcLimit) type = "tf";
      let options = q.options.slice(0, 4);
      let correctAnswerIndex = q.correctAnswerIndex;
      if (type === "tf") {
        options = ["True", "False"];
        correctAnswerIndex = correctAnswerIndex <= 0 ? 0 : 1;
      }
      if (type === "tf") tfSeen++;
      else mcSeen++;
      return {
        ...q,
        id: i,
        type,
        options,
        correctAnswerIndex: Math.min(correctAnswerIndex, options.length - 1),
        difficulty: ["easy", "medium", "hard"].includes(q.difficulty)
          ? q.difficulty
          : "medium",
      };
    })
    .slice(0, questionTarget);
}

function buildReviewer(
  docs: ExtractedDocument[],
  parsed: GeneratedPayload,
  questionTarget: number
): ReviewerData {
  const totalWords = docs.reduce((s, d) => s + d.wordCount, 0);
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    summary: {
      title: parsed.title || "Study Reviewer",
      overview: parsed.overview || "",
      keyTakeaways: parsed.keyTakeaways ?? [],
      docCount: docs.length,
      totalPages: docs.reduce((s, d) => s + (d.pageCount ?? 0), 0),
      totalWords,
      targetStudyMinutes: parsed.targetStudyMinutes || Math.max(10, Math.round(totalWords / 220)),
    },
    topics: (parsed.topics ?? []).slice(0, 20),
    terms: (parsed.terms ?? []).slice(0, 100),
    quizBank: normalizeQuiz(parsed, questionTarget),
    engine: "ai",
  };
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userContent: string,
  jsonSchema: string
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
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Gemini API error (HTTP ${res.status})`);
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
  jsonSchema: string
): Promise<string> {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: MAX_OUTPUT_TOKENS,
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
  if (!res.ok) throw new Error(`Provider API error (HTTP ${res.status})`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Provider returned an empty response.");
  return content;
}

export async function generateWithAI(
  docs: ExtractedDocument[],
  questionTarget: number,
  keys: ProviderKeys,
  modelOverrides?: Partial<Record<keyof ProviderKeys, string>>,
  draft?: SourceDraft
): Promise<ReviewerData> {
  const documentsText = docs
    .map(
      (d) =>
        `--- ${d.name} (${d.format}) ---\n${d.text.slice(0, MAX_INPUT_CHARS)}`
    )
    .join("\n\n");

  const draftText =
    draft &&
    `\n\nCandidate draft extracted from the source (verify, correct, or discard as needed):\n${JSON.stringify(draft)}`;
  const userContent = `${documentsText}${draftText ?? ""}`;

  const systemPrompt = buildSystemPrompt(questionTarget);
  const jsonSchema = buildJsonSchema();

  const failures: string[] = [];
  for (const provider of PROVIDERS) {
    const apiKeys = keys[provider.id];
    if (!apiKeys || apiKeys.length === 0) continue;
    const model = modelOverrides?.[provider.id]?.trim() || provider.defaultModel;
    for (let ki = 0; ki < apiKeys.length; ki++) {
      const apiKey = apiKeys[ki];
      try {
        const raw =
          provider.kind === "gemini"
            ? await callGemini(apiKey, model, systemPrompt, userContent, jsonSchema)
            : await callOpenAICompat(
                apiKey,
                provider.baseUrl!,
                model,
                systemPrompt,
                userContent,
                jsonSchema
              );
        const cleaned = stripCodeFence(raw);
        const parsed = JSON.parse(cleaned) as GeneratedPayload;
        if (!validatePayload(parsed)) {
          throw new Error("The model returned a malformed response.");
        }
        if (
          !Array.isArray(parsed.topics) ||
          parsed.topics.length === 0 ||
          !Array.isArray(parsed.terms) ||
          parsed.terms.length === 0
        ) {
          throw new Error("The model returned no topics or terms.");
        }
      const reviewer = buildReviewer(docs, parsed, questionTarget);
      const offlineQuiz = buildOfflineQuiz(docs, questionTarget);
      const existing = new Set(reviewer.quizBank.map((q) => q.question.toLowerCase()));
      for (const q of offlineQuiz) {
        if (reviewer.quizBank.length >= questionTarget) break;
        const key = q.question.toLowerCase();
        if (existing.has(key)) continue;
        existing.add(key);
        reviewer.quizBank.push({
          ...q,
          id: reviewer.quizBank.length + q.id,
        });
      }
      console.log(
        `[generate] provider=${provider.name} key=${ki} model=${model} topics=${reviewer.topics.length} terms=${reviewer.terms.length} quiz=${reviewer.quizBank.length}`
      );
      return reviewer;
      } catch (err) {
        failures.push(
          `${provider.name}[key ${ki}] (${err instanceof Error ? err.message : "unknown error"})`
        );
      }
    }
  }

  throw new Error(
    failures.length > 0
      ? `All AI providers failed: ${failures.join("; ")}`
      : "No AI provider keys configured."
  );
}
