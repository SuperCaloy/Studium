import { NextRequest, NextResponse } from "next/server";
import { buildProviderKeys, rateLimited, clientIp, originAllowed, MAX_BODY_BYTES } from "@/lib/api-helpers";
import { PROVIDERS } from "@/lib/ai-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (await rateLimited(clientIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }

  const { keys, modelOverrides } = buildProviderKeys();
  const hasAnyKey = Object.values(keys).some((k) => k && k.length > 0);

  if (!hasAnyKey) {
    return NextResponse.json(
      { error: "AI explanation is temporarily unavailable because no AI provider keys are configured on the server." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const question = typeof b.question === "string" ? b.question : "";
  const selected = typeof b.selected === "string" ? b.selected : "";
  const correct = typeof b.correct === "string" ? b.correct : "";
  const context = typeof b.context === "string" ? b.context : "";
  const options = Array.isArray(b.options) ? b.options : [];

  if (!question || !options.length) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const safeContext = context ? context.slice(0, 1500) : "";
  const prompt = `Question: ${question}
Options: ${options.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n')}
Correct: ${correct}
Selected: ${selected}

${safeContext ? `Context:\n${safeContext}\n\n` : ''}You are a professional academic tutor. Explain precisely why the Correct answer is right based on the context. Focus ONLY on explaining the correct answer; do NOT mention or explain the user's selected wrong answer.
CRITICAL RULES:
1. DO NOT start your response with "The correct answer is", "Option X is", or any similar robotic preamble.
2. Jump straight into the explanation (e.g. start immediately with the concept name like "Acceptance testing verifies...").
3. Do NOT use em-dashes (—).
4. Keep the explanation extremely concise, direct, and under 80 words. Use standard markdown. No JSON.`;

  // Determine provider order (Groq/Mistral first for sub-second generation speed)
  const fastIds = ["groq", "mistral", "sambanova", "openrouter"];
  const order = [
    ...PROVIDERS.filter(p => fastIds.includes(p.id)),
    ...PROVIDERS.filter(p => !fastIds.includes(p.id))
  ];

  let lastError = "No valid API keys found.";

  for (const provider of order) {
    const apiKeys = keys[provider.id];
    if (!apiKeys || apiKeys.length === 0) continue;

    const override = modelOverrides[provider.id]?.trim();
    const model = override || provider.models[0];

    // Shuffle the keys to balance load, but try all of them
    const shuffledKeys = [...apiKeys].sort(() => 0.5 - Math.random());

    for (const key of shuffledKeys) {
      try {
        let text = "";

        if (provider.kind === "gemini") {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 500, temperature: 0.4 }
            }),
          });
          if (!res.ok) throw new Error(await res.text().catch(() => "Gemini API Error"));
          const data = await res.json();
          text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            throw new Error(`Empty response. Reason: ${data.candidates?.[0]?.finishReason || 'Unknown'}`);
          }
        } else {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          };
          const res = await fetch(provider.baseUrl!, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model,
              temperature: 0.4,
              max_tokens: 500,
              messages: [{ role: "user", content: prompt }]
            }),
          });
          if (!res.ok) throw new Error(await res.text().catch(() => "OpenAI Compat Error"));
          const data = await res.json();
          text = data.choices?.[0]?.message?.content;
        }

        if (text) return NextResponse.json({ explanation: text });
      } catch (err) {
        console.warn(`[Explain API] ${provider.id} failed with key:`, err instanceof Error ? err.message : err);
        lastError = err instanceof Error ? err.message : "unknown error";
        continue; // Try next key
      }
    }
  }

  return NextResponse.json({ error: "Failed to fetch explanation from all available AI providers. Please try again later." }, { status: 502 });
}
