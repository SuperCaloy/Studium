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
  const totalChars = docs.reduce((s, d) => s + d.text.length, 0);
  
  if (totalChars > 200000) {
    return NextResponse.json(
      { error: "Document is too large. Please limit to approximately 50,000 words to ensure reliable generation." },
      { status: 413 }
    );
  }

  const sourceText = docs.map((d) => d.text).join("\n\n");
  const questionTarget = 100;
  const isStream = req.nextUrl.searchParams.get("stream") === "true";

  if (isStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          if (!hasAnyKey) throw new Error("No AI provider keys configured.");
          
          const { cleanedDocs, draft, protectedFacts, protectedSpans } = prepareDraft(docs);
          const result = await generateCards(
            cleanedDocs,
            keys,
            modelOverrides,
            draft,
            protectedFacts,
            factsFromSpans(protectedSpans),
            (event, data) => send(event, data) // stream topics and terms as they finish
          );
          
          const cards = result.reviewer;
          const aiQuiz = cards.quizBank || [];
          const proceduralQuiz = buildQuizFromReviewer(
            cards.topics,
            cards.terms,
            cards.summary.keyTakeaways,
            sourceText,
            questionTarget - aiQuiz.length
          );
          
          // Fix IDs of procedural quiz to not clash with AI quiz
          const mergedQuiz = [...aiQuiz];
          let seq = aiQuiz.length;
          for (const q of proceduralQuiz) {
            mergedQuiz.push({ ...q, id: seq++ });
          }
          
          const reviewer = { ...cards, quizBank: mergedQuiz };
          send("quiz", mergedQuiz);
          send("done", reviewer);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "unknown error";
          send("error", { message: msg });
          // Fallback handled by client
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

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
      const aiQuiz = cards.quizBank || [];
      const proceduralQuiz = buildQuizFromReviewer(
        cards.topics,
        cards.terms,
        cards.summary.keyTakeaways,
        sourceText,
        questionTarget - aiQuiz.length
      );
      
      const mergedQuiz = [...aiQuiz];
      let seq = aiQuiz.length;
      for (const q of proceduralQuiz) {
        mergedQuiz.push({ ...q, id: seq++ });
      }
      
      reviewer = { ...cards, quizBank: mergedQuiz };
      console.log(
        `[generate] ai ok docs=${docs.length} words=${totalWords} topics=${reviewer.topics.length} terms=${reviewer.terms.length} quiz=${mergedQuiz.length} ms=${Date.now() - started}`
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
