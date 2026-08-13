import { NextRequest, NextResponse } from "next/server";
import { generateWithAI } from "@/lib/ai-generator";
import {
  buildOfflineReviewer,
  prepareDraft,
} from "@/lib/reviewer-generator";
import type { ExtractedDocument, FileFormat } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_DOCS = 20;
const MAX_TEXT_CHARS = 60000;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_TARGET = 70;
const MIN_TARGET = 1;

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 15;
const RATE_TRACKER = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = RATE_TRACKER.get(key);
  if (!entry || entry.resetAt <= now) {
    RATE_TRACKER.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX_PER_WINDOW;
}

function readKeys(base: string): string[] | undefined {
  const out: string[] = [];
  for (const suffix of ["", "_2", "_3", "_4", "_5"]) {
    const raw = process.env[`${base}${suffix}`];
    if (!raw) continue;
    for (const part of raw.split(",")) {
      const k = part.trim();
      if (k && !out.includes(k)) out.push(k);
    }
  }
  return out.length > 0 ? out : undefined;
}

function readSingleKey(base: string): string[] | undefined {
  const raw = process.env[base]?.trim();
  return raw ? [raw] : undefined;
}

function readModel(base: string): string | undefined {
  return process.env[`${base}_MODEL`]?.trim() || undefined;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  return real?.trim() || "unknown";
}

function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return false;
  try {
    const o = new URL(origin);
    return o.host === host;
  } catch {
    return false;
  }
}

function sanitizeDocs(raw: unknown): ExtractedDocument[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0 || raw.length > MAX_DOCS) return null;
  const formats: FileFormat[] = ["pdf", "docx", "txt"];
  const docs: ExtractedDocument[] = [];
  for (let i = 0; i < raw.length; i++) {
    const d = raw[i];
    if (!d || typeof d !== "object") return null;
    const o = d as Record<string, unknown>;
    const name =
      typeof o.name === "string" ? o.name.slice(0, 200) : `Document ${i + 1}`;
    const text = typeof o.text === "string" ? o.text : "";
    if (text.trim().length < 20) return null;
    docs.push({
      id: typeof o.id === "string" ? o.id : `doc-${i}`,
      name,
      format: formats.includes(o.format as FileFormat)
        ? (o.format as FileFormat)
        : "txt",
      sizeBytes: typeof o.sizeBytes === "number" ? o.sizeBytes : 0,
      pageCount: typeof o.pageCount === "number" ? o.pageCount : undefined,
      paragraphCount:
        typeof o.paragraphCount === "number" ? o.paragraphCount : undefined,
      lineCount: typeof o.lineCount === "number" ? o.lineCount : undefined,
      wordCount: typeof o.wordCount === "number" ? o.wordCount : 0,
      charCount: typeof o.charCount === "number" ? o.charCount : 0,
      text: text.slice(0, MAX_TEXT_CHARS),
      flags: Array.isArray(o.flags)
        ? o.flags.map(String).slice(0, 20)
        : [],
    });
  }
  return docs;
}

export async function POST(req: NextRequest) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (rateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429 }
    );
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request too large." },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const docs = sanitizeDocs(b.docs);
  if (!docs) {
    return NextResponse.json(
      { error: "Provide between 1 and 20 documents with usable text." },
      { status: 400 }
    );
  }

  const rawTarget = Number(b.questionTarget);
  const questionTarget = Number.isFinite(rawTarget)
    ? Math.min(MAX_TARGET, Math.max(MIN_TARGET, Math.round(rawTarget)))
    : 20;

  const keys = {
    gemini: readKeys("GEMINI_API_KEY"),
    groq: readSingleKey("GROQ_API_KEY"),
    openrouter: readSingleKey("OPENROUTER_API_KEY"),
    mistral: readSingleKey("MISTRAL_API_KEY"),
  };
  const modelOverrides = {
    gemini: readModel("GEMINI"),
    groq: readModel("GROQ"),
    openrouter: readModel("OPENROUTER"),
    mistral: readModel("MISTRAL"),
  };

  const hasAnyKey = Object.values(keys).some((k) => k && k.length > 0);
  const totalWords = docs.reduce((s, d) => s + d.wordCount, 0);

  if (hasAnyKey) {
    const started = Date.now();
    try {
      const { cleanedDocs, draft } = prepareDraft(docs);
      const reviewer = await generateWithAI(
        cleanedDocs,
        questionTarget,
        keys,
        modelOverrides,
        draft
      );
      console.log(
        `[generate] ai ok docs=${docs.length} words=${totalWords} quiz=${reviewer.quizBank.length} ms=${Date.now() - started}`
      );
      return NextResponse.json({ reviewer });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      console.error(`[generate] ai failed, falling back: ${msg}`);
    }
  }

  const reviewer = buildOfflineReviewer(docs, questionTarget);
  console.log(
    `[generate] offline docs=${docs.length} words=${totalWords} quiz=${reviewer.quizBank.length}`
  );
  return NextResponse.json({
    reviewer,
    notice: hasAnyKey
      ? "AI generation failed, so the offline engine was used instead."
      : undefined,
  });
}
