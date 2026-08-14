import { NextRequest } from "next/server";
import { buildProviderKeys, rateLimited, clientIp } from "@/lib/api-helpers";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  if (await rateLimited(clientIp(req))) {
    return new Response("Too many requests", { status: 429 });
  }

  const { keys } = buildProviderKeys();
  const geminiKeys = keys.gemini || [];
  const key = geminiKeys.length > 0 ? geminiKeys[Math.floor(Math.random() * geminiKeys.length)] : null;

  if (!key) {
    return new Response("No API key available for explanations. Add a Gemini key in settings.", { status: 503 });
  }

  const body = await req.json();
  const { question, options, selected, correct } = body;

  const prompt = `You are an expert tutor. A student just answered a multiple choice question.
Question: ${question}
Options: ${options.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n')}
The correct answer is: ${correct}
The student selected: ${selected}

Explain concisely why the correct answer is right, and if the student selected wrong, briefly explain why their choice is incorrect. Keep it encouraging and under 3 short paragraphs. Use markdown formatting.`;

  const sseResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    })
  });

  if (!sseResponse.ok) {
    return new Response("Failed to fetch explanation", { status: 500 });
  }

  return new Response(sseResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
