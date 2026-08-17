import { NextRequest, NextResponse } from "next/server";
import { buildProviderKeys, rateLimited, clientIp, originAllowed, MAX_BODY_BYTES } from "@/lib/api-helpers";
import { PROVIDERS } from "@/lib/ai-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return NextResponse.json({ error: "No AI provider keys configured." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { message, context, history } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    const systemPrompt = `You are an expert, academic tutor designed to help a student study for their exams. 
You have been provided with the student's study materials below. 

CONTEXT (Study Notes):
${context}

INSTRUCTIONS:
1. Answer the student's question accurately and academically using ONLY the provided context.
2. If the answer is not in the context, politely state that you cannot answer it based on the provided notes.
3. Be EXTREMELY concise. Optimize for token usage. Your answers should rarely exceed 3-4 sentences unless absolutely necessary.
4. Use clear, direct language. Avoid fluff and filler words.
5. NEVER use em-dashes (—). Use normal hyphens or colons instead.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history : []),
      { role: "user", content: message }
    ];

    // Try providers in order
    for (const provider of PROVIDERS) {
      let apiKey = keys[provider.id as keyof typeof keys];
      if (!apiKey) continue;

      const modelId = modelOverrides[provider.id as keyof typeof modelOverrides] || provider.models[0];

      try {
        const payload: Record<string, unknown> = {
          model: modelId,
          messages,
          temperature: 0.2, // Keep it deterministic and academic
          max_tokens: 300, // Strict token limit for concise answers
        };

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (provider.kind === "gemini") {
          // Format for Gemini REST API
          const geminiUrl = `${provider.baseUrl}/models/${modelId}:generateContent?key=${apiKey}`;
          
          const geminiContents = messages.map(m => ({
            role: m.role === 'system' ? 'user' : (m.role === 'assistant' ? 'model' : 'user'),
            parts: [{ text: m.content }]
          }));

          const res = await fetch(geminiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
              contents: geminiContents,
              generationConfig: { maxOutputTokens: 300, temperature: 0.2 }
            }),
            signal: AbortSignal.timeout(15000), // Fast timeout for chat
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return NextResponse.json({ reply: text });

        } else {
          // Standard OpenAI format
          headers["Authorization"] = `Bearer ${apiKey}`;
          
          if (provider.id === "anthropic") {
            headers["x-api-key"] = apiKey;
            headers["anthropic-version"] = "2023-06-01";
            delete headers["Authorization"];
          }

          const res = await fetch(provider.baseUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000),
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          
          let text = "";
          if (provider.id === "anthropic") {
            text = data.content?.[0]?.text;
          } else {
            text = data.choices?.[0]?.message?.content;
          }

          if (text) return NextResponse.json({ reply: text });
        }
      } catch (err) {
        console.error(`[Tutor API] ${provider.id} failed:`, err instanceof Error ? err.message : err);
        continue;
      }
    }

    return NextResponse.json({ error: "Failed to generate a reply. Please try again later." }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
