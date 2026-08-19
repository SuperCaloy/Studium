import type {
  ConceptMapData,
  ExecutiveSummary,
  Fact,
  QuizQuestion,
  ReviewerData,
  TermDefinition,
  TopicAccordion,
} from "./types";
import { REVIEWER_SCHEMA_VERSION } from "./types";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

function normalizeQuestion(q: unknown, index: number): QuizQuestion | null {
  if (!q || typeof q !== "object") return null;
  const o = q as Record<string, unknown>;
  if (typeof o.question !== "string" || !Array.isArray(o.options)) return null;
  return {
    // Preserve a valid numeric id; only fall back to the slot index when the
    // stored id is unusable (legacy / malformed data).
    id: typeof o.id === "number" && Number.isFinite(o.id) ? o.id : index,
    type: o.type === "tf" || o.type === "mcq" ? o.type : "mcq",
    question: o.question,
    options: o.options.map(String).slice(0, 8),
    correctAnswerIndex:
      typeof o.correctAnswerIndex === "number" ? o.correctAnswerIndex : 0,
    explanation: typeof o.explanation === "string" ? o.explanation : "",
    sourceDoc: typeof o.sourceDoc === "string" ? o.sourceDoc : undefined,
    difficulty: DIFFICULTIES.includes(o.difficulty as never)
      ? (o.difficulty as QuizQuestion["difficulty"])
      : "easy",
  };
}

/**
 * Migrates an arbitrary persisted value into a current-schema ReviewerData.
 * Returns null when the value is structurally incompatible (nothing can be
 * salvaged); the caller decides whether to keep or discard it. Replaces the
 * old "clear all reviewers on any version mismatch" behavior in storage.ts.
 */
export function migrateReviewer(raw: unknown): ReviewerData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    !r.summary ||
    typeof r.summary !== "object" ||
    !Array.isArray(r.quizBank)
  ) {
    return null;
  }

  const summary = r.summary as Record<string, unknown>;
  const quizBank: QuizQuestion[] = [];
  for (let i = 0; i < r.quizBank.length; i++) {
    const q = normalizeQuestion(r.quizBank[i], i);
    if (q) quizBank.push(q);
  }

  // Legacy reviewers could have every question collide on id 0; remap to
  // sequential ids only when the stored ids are not already unique.
  const seen = new Set<number>();
  let hasCollision = false;
  for (const q of quizBank) {
    if (seen.has(q.id)) {
      hasCollision = true;
      break;
    }
    seen.add(q.id);
  }
  if (hasCollision) {
    for (let i = 0; i < quizBank.length; i++) quizBank[i].id = i;
  }

  const conceptMap = r.conceptMap as ConceptMapData | undefined;

  return {
    id: r.id,
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
    summary: {
      title: typeof summary.title === "string" ? summary.title : "",
      overview: typeof summary.overview === "string" ? summary.overview : "",
      keyTakeaways: Array.isArray(summary.keyTakeaways)
        ? summary.keyTakeaways.map(String)
        : [],
      docCount: typeof summary.docCount === "number" ? summary.docCount : 0,
      totalPages: typeof summary.totalPages === "number" ? summary.totalPages : 0,
      totalWords: typeof summary.totalWords === "number" ? summary.totalWords : 0,
      targetStudyMinutes:
        typeof summary.targetStudyMinutes === "number"
          ? summary.targetStudyMinutes
          : 0,
    } as ExecutiveSummary,
    topics: Array.isArray(r.topics) ? (r.topics as TopicAccordion[]) : [],
    terms: Array.isArray(r.terms) ? (r.terms as TermDefinition[]) : [],
    facts: Array.isArray(r.facts) ? (r.facts as Fact[]) : [],
    quizBank,
    conceptMap: conceptMap
      ? {
          isNeeded: !!conceptMap.isNeeded,
          mappings: Array.isArray(conceptMap.mappings)
            ? conceptMap.mappings.map((m) =>
                Array.isArray(m)
                  ? m.map(String).slice(0, 3)
                  : ["", "", ""]
              )
            : undefined,
        }
      : { isNeeded: false },
    engine: r.engine === "offline" ? "offline" : "ai",
    version: REVIEWER_SCHEMA_VERSION,
  };
}
