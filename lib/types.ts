export type FileFormat = "pdf" | "docx" | "txt";

export interface ExtractedDocument {
  id: string;
  name: string;
  format: FileFormat;
  sizeBytes: number;
  pageCount?: number;
  paragraphCount?: number;
  lineCount?: number;
  wordCount: number;
  charCount: number;
  text: string;
  flags: string[];
}

export interface QueueItem {
  id: string;
  name: string;
  format: FileFormat;
  sizeBytes: number;
  status: "queued" | "parsing" | "ready" | "error";
  error?: string;
  extracted?: ExtractedDocument;
}

export interface TermDefinition {
  id: string;
  term: string;
  definition: string;
  sourceDoc?: string;
  enriched?: boolean;
}

export interface TopicDetail {
  id: string;
  heading: string;
  points: string[];
  enriched?: boolean;
}

export interface TopicAccordion {
  id: string;
  title: string;
  summary: string;
  details: TopicDetail[];
}

export interface QuizQuestion {
  id: number;
  type?: "mcq" | "tf";
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  sourceDoc?: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface ExecutiveSummary {
  title: string;
  overview: string;
  keyTakeaways: string[];
  docCount: number;
  totalPages: number;
  totalWords: number;
  targetStudyMinutes: number;
}

export interface Fact {
  formula: string;
  context: string;
}

export const REVIEWER_SCHEMA_VERSION = 2;

export interface ReviewerData {
  id: string;
  createdAt: number;
  updatedAt: number;
  summary: ExecutiveSummary;
  topics: TopicAccordion[];
  terms: TermDefinition[];
  facts: Fact[];
  quizBank: QuizQuestion[];
  engine: "ai" | "offline";
  version?: number;
}

export type GenerationStep =
  | "parsing"
  | "compiling"
  | "extracting"
  | "building"
  | "done"
  | "error";

export interface GenerationProgress {
  step: GenerationStep;
  percent: number;
  message: string;
}
