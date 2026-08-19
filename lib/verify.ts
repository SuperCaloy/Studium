import type { QuizQuestion, ReviewerData } from "./types";

const UNIT_SUFFIX =
  /(?:%|percent|km|cm|mm|µm|nm|m|kg|g|mg|µg|ml|mL|L|s|min|hr|hrs|°C|°F|K|mol|atm|Pa|J|N|W|V|A|Hz|M|kWh|cal|kcal|moles|molecules|grams|liters|days?|weeks?|months?|years?|million|billion|thousand)\b/i;

const FORMULA_CHARS = /[=≈≠<>≤≥→←²³√±×·÷πΔΣ∫]/;

export function extractSignificantTokens(text: string): string[] {
  const tokens = new Set<string>();
  for (const m of text.matchAll(/\b\d+(?:[.,]\d+)?\s*[a-zA-Z%°µ]*\b/g)) {
    const raw = m[0];
    let compact = raw
      .replace(/\s+/g, "")
      .replace(/,/g, "")
      .replace(/%/g, "percent")
      .toLowerCase();
    if (compact.length < 2) continue;
    if (!/\d/.test(compact)) continue;
    tokens.add(compact);
  }
  return Array.from(tokens);
}

export function extractFormulas(text: string): string[] {
  const formulas = new Set<string>();
  const re = /[A-Za-z0-9_²³√πΔΣ\s]*(?:[=≈≠<>≤≥→←]|²|³|√)[A-Za-z0-9_²³√πΔΣ%°\s]*/g;
  for (const m of text.matchAll(re)) {
    const f = m[0].trim().replace(/\s+/g, " ").toLowerCase();
    if (f.length < 3 || f.length > 120) continue;
    if (!/\d|[=≈≠<>≤≥→←]|²|³|√/.test(f)) continue;
    formulas.add(f);
  }
  for (const m of text.matchAll(/\b[A-Z][a-z]?\d{0,2}(?:[A-Z][a-z]?\d{0,2}){1,}\b/g)) {
    const f = m[0].toLowerCase();
    if (/\d/.test(f)) formulas.add(f);
  }
  return Array.from(formulas);
}

function questionText(q: QuizQuestion): string {
  return `${q.question} ${q.options.join(" ")} ${q.explanation ?? ""}`;
}

export function isQuestionGrounded(
  q: QuizQuestion,
  sourceNums: Set<string>,
  sourceFormulas: Set<string>
): boolean {
  const stem = `${q.question} ${q.explanation ?? ""}`;
  const stemNums = extractSignificantTokens(stem);
  if (stemNums.length > 0 && stemNums.some((n) => !sourceNums.has(n))) return false;

  const qFormulas = extractFormulas(questionText(q)).filter((f) => FORMULA_CHARS.test(f));
  if (qFormulas.some((f) => !sourceFormulas.has(f))) return false;

  return true;
}

export interface VerificationResult {
  reviewer: ReviewerData;
  replaced: number;
  /** Unused offline-pool questions left after replacements were drawn. */
  pool: QuizQuestion[];
}

export function verifyReviewerAgainstSource(
  reviewer: ReviewerData,
  sourceText: string,
  offlinePool: QuizQuestion[]
): VerificationResult {
  const sourceNums = new Set(extractSignificantTokens(sourceText));
  const sourceFormulas = new Set(extractFormulas(sourceText));

  const usedOffline = new Set(reviewer.quizBank.map((q) => q.question.toLowerCase()));
  const poolQueue = offlinePool.filter((q) => !usedOffline.has(q.question.toLowerCase()));

  let replaced = 0;
  const bank = reviewer.quizBank.map((q) => {
    if (isQuestionGrounded(q, sourceNums, sourceFormulas)) return q;
    const replacement = poolQueue.shift();
    if (!replacement) return q;
    replaced++;
    usedOffline.add(replacement.question.toLowerCase());
    return {
      ...replacement,
      id: q.id,
      sourceDoc: replacement.sourceDoc ?? q.sourceDoc,
    };
  });

  return { reviewer: { ...reviewer, quizBank: bank }, replaced, pool: poolQueue };
}
