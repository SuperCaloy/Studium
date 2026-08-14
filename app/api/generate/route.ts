import { NextRequest, NextResponse } from "next/server";
import { generateCards } from "@/lib/ai-generator";
import type { ReviewerData } from "@/lib/types";
import {
  buildOfflineReviewer,
  buildQuizFromReviewer,
  factsFromSpans,
  prepareDraft,
} from "@/lib/reviewer-generator";
import {
  MAX_BODY_BYTES,
  buildProviderKeys,
  clientIp,
  originAllowed,
  rateLimited,
  sanitizeDocs,
} from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (await rateLimited(clientIp(req))) {
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

  const { keys, modelOverrides } = buildProviderKeys();
  const hasAnyKey = Object.values(keys).some((k) => k && k.length > 0);
  const totalWords = docs.reduce((s, d) => s + d.wordCount, 0);
  const sourceText = docs.map((d) => d.text).join("\n\n");
  const questionTarget = 70;

  let reviewer: ReviewerData | null = null;
  let fallback = false;

  if (hasAnyKey) {
    const started = Date.now();
    try {
      const { cleanedDocs, draft, protectedFacts, protectedSpans } =
        prepareDraft(docs);
      const result = await generateCards(
        cleanedDocs,
        keys,
        modelOverrides,
        draft,
        protectedFacts,
        factsFromSpans(protectedSpans)
      );
      const cards = result.reviewer;
      const quiz = buildQuizFromReviewer(
        cards.topics,
        cards.terms,
        cards.summary.keyTakeaways,
        sourceText,
        questionTarget
      );
      reviewer = { ...cards, quizBank: quiz };
      console.log(
        `[generate] ai ok docs=${docs.length} words=${totalWords} topics=${reviewer.topics.length} terms=${reviewer.terms.length} quiz=${quiz.length} ms=${Date.now() - started}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      fallback = true;
      console.error(`[generate] ai failed, using offline: ${msg}`);
    }
  }

  if (!reviewer) {
    fallback = true;
    reviewer = buildOfflineReviewer(docs, 70);
  }

  if (reviewer.quizBank.length === 0) {
    reviewer = {
      ...reviewer,
      quizBank: buildQuizFromReviewer(
        reviewer.topics,
        reviewer.terms,
        reviewer.summary.keyTakeaways,
        sourceText,
        questionTarget
      ),
    };
  }

  console.log(
    `[generate] respond engine=${reviewer.engine} docs=${docs.length} words=${totalWords} quiz=${reviewer.quizBank.length} fallback=${fallback}`
  );
  return NextResponse.json({
    reviewer,
    fallback,
    phase: reviewer.engine,
  });
}
