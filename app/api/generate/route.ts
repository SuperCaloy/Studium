import { NextRequest, NextResponse } from "next/server";
import { generateCards } from "@/lib/ai-generator";
import {
  buildOfflineReviewer,
  buildQuizFromReviewer,
  factsFromSpans,
  prepareDraft,
} from "@/lib/reviewer-generator";
import { verifyReviewerAgainstSource } from "@/lib/verify";
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
// Gemini's provider timeout is 120s and the 429 retry can add another full
// call, so the platform budget must exceed that or the stream gets killed
// mid-generation. A per-request deadline below this forces an early offline
// fallback instead of stranding the client. See notes/known-issues/bugs.md P2.
export const maxDuration = 300;

const GENERATION_DEADLINE_MS = 240_000;

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

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // content-length can be omitted or spoofed; enforce the cap on the actual
  // body bytes as well so an oversized request never gets fully parsed.
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request too large." },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    body = rawBody.length > 0 ? JSON.parse(rawBody) : {};
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
  const totalChars = docs.reduce((s, d) => s + d.text.length, 0);
  
  if (totalChars > 300000) {
    return NextResponse.json(
      { error: "Document is too large. Please limit to approximately 75,000 words to ensure reliable generation." },
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
          
          // Skip the expensive offline term/topic extraction when AI will run;
          // the offline fallback recomputes it if AI fails (P3).
          const { cleanedDocs, draft, protectedFacts, protectedSpans } = prepareDraft(docs, {
            skipTopicTermExtraction: true,
          });
          const result = await Promise.race([
            generateCards(
              cleanedDocs,
              keys,
              modelOverrides,
              draft,
              protectedFacts,
              factsFromSpans(protectedSpans),
              (event, data) => send(event, data) // stream topics and terms as they finish
            ),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("Generation timed out.")),
                GENERATION_DEADLINE_MS
              )
            ),
          ]);
          
          const cards = result.reviewer;
          const aiQuiz = cards.quizBank || [];
          const proceduralQuiz = buildQuizFromReviewer(
            cards.topics,
            cards.terms,
            cards.summary.keyTakeaways,
            sourceText,
            questionTarget
          );

          send("progress", {
            step: "building",
            percent: 82,
            message: "Verifying facts and building quiz questions...",
            topics: cards.topics.length,
            terms: cards.terms.length,
            quiz: aiQuiz.length,
            chunksDone: 0,
            chunksTotal: 0,
          });

          // Replace AI questions that cite numbers/formulas absent from the
          // source with grounded offline questions, then top up to the target
          // from the unused pool. See [[decisions/grounding-verification]].
          const verified = verifyReviewerAgainstSource(
            { ...cards, quizBank: aiQuiz },
            sourceText,
            proceduralQuiz
          );

          const mergedQuiz = [...verified.reviewer.quizBank];
          let seq = mergedQuiz.length;
          for (const q of verified.pool) {
            if (mergedQuiz.length >= questionTarget) break;
            mergedQuiz.push({ ...q, id: seq++ });
          }

          const reviewer = { ...cards, quizBank: mergedQuiz };
          if (verified.replaced > 0) {
            send("grounding", { replaced: verified.replaced });
          }
          send("quiz", mergedQuiz);
          send("done", reviewer);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "unknown error";
          console.error(`[generate] ai failed, streaming offline fallback: ${msg}`);
          // Stream a complete offline reviewer instead of an error so the
          // client never shows (or saves) an empty streaming skeleton.
          try {
            const offline = buildOfflineReviewer(docs, 70);
            const offlineQuiz =
              offline.quizBank.length > 0
                ? offline.quizBank
                : buildQuizFromReviewer(
                    offline.topics,
                    offline.terms,
                    offline.summary.keyTakeaways,
                    sourceText,
                    questionTarget
                  );
            send("progress", {
              step: "building",
              percent: 92,
              message: "Building reviewer from local engine...",
              topics: offline.topics.length,
              terms: offline.terms.length,
              quiz: offlineQuiz.length,
              chunksDone: 0,
              chunksTotal: 0,
            });
            send("quiz", offlineQuiz);
            send("done", { ...offline, quizBank: offlineQuiz });
          } catch (offlineErr) {
            const omsg =
              offlineErr instanceof Error ? offlineErr.message : "unknown error";
            send("error", { message: omsg });
          }
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

  // The UI exclusively calls ?stream=true; a non-streaming JSON path is no
  // longer provided.
  return NextResponse.json(
    { error: "Streaming mode required." },
    { status: 400 }
  );
}
