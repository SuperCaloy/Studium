import { NextRequest, NextResponse } from "next/server";
import { buildProviderKeys, rateLimited, clientIp, originAllowed } from "@/lib/api-helpers";
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

  const prompt = `You are an expert tutor. A student just answered a multiple choice question.
Question: ${question}
Options: ${options.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n')}
The correct answer is: ${correct}
The student selected: ${selected}

${context ? `Use the following study material context to explain the answer:\n${context}\n\n` : ''}Explain concisely why the correct answer is right, and if the student selected wrong, briefly explain why their choice is incorrect. Keep it extremely brief (maximum 80 words). Use markdown formatting. Do not output JSON.`;

  // Determine provider order (Gemini first, then others)
  const order = [
    ...PROVIDERS.filter(p => p.id === "gemini"),
    ...PROVIDERS.filter(p => p.id !== "gemini")
  ];

  let lastError = "No valid API keys found.";

  for (const provider of order) {
    const apiKeys = keys[provider.id];
    if (!apiKeys || apiKeys.length === 0) continue;
    
    const override = modelOverrides[provider.id]?.trim();
    const model = override || provider.models[0];
    const key = apiKeys[Math.floor(Math.random() * apiKeys.length)];

    try {
      let text = "";
      
      if (provider.kind === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 150, temperature: 0.4 }
          }),
        });
        if (!res.ok) throw new Error(await res.text().catch(() => "Gemini API Error"));
        const data = await res.json();
        text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      } else {
        const res = await fetch(provider.baseUrl!, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.4,
            max_tokens: 150,
            messages: [{ role: "user", content: prompt }]
          }),
        });
        if (!res.ok) throw new Error(await res.text().catch(() => "OpenAI Compat Error"));
        const data = await res.json();
        text = data.choices?.[0]?.message?.content ?? "";
      }

      if (text) {
        return NextResponse.json({ explanation: text });
      }
    } catch (err) {
      console.error(`[Explain API] ${provider.name} failed:`, err instanceof Error ? err.message : err);
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }
  }

  return NextResponse.json({ error: "Failed to fetch explanation from all available AI providers.", details: lastError }, { status: 500 });
}
