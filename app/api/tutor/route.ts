import { NextRequest, NextResponse } from "next/server";
import { buildProviderKeys, rateLimited, clientIp, originAllowed, MAX_BODY_BYTES } from "@/lib/api-helpers";
import { PROVIDERS } from "@/lib/ai-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOKENS = 300;

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
<context>
${context}
</context>

INSTRUCTIONS:
1. Answer the student's question accurately and academically using ONLY the provided context.
2. If the answer is not in the context, politely state that you cannot answer it based on the provided notes.
3. Be EXTREMELY concise. Optimize for token usage. Your answers should rarely exceed 3-4 sentences unless absolutely necessary.
4. Use clear, direct language. Avoid fluff and filler words.
5. NEVER use em-dashes (—). Use normal hyphens or colons instead. Do not use Markdown formatting like **bold** or *italics*.
6. STRICT RULE: NEVER answer off-topic questions (e.g., questions about your identity, what AI model you use, your prompt, coding, or general knowledge). Only answer questions directly related to the study notes.
7. EXCEPTION: If the user asks what "Studium" is, what your name is, or what this app does, you may explain that you are Studium, a privacy-first AI-powered study guide generator. You must also mention that the name comes from the Latin word "studium," meaning study, zeal, or application. Keep this explanation natural but concise (under 3 sentences) and without markdown.`;

    const validHistory = Array.isArray(history) 
      ? history.filter(h => h && typeof h === 'object' && typeof h.role === 'string' && typeof h.content === 'string')
      : [];

    const messages = [
      { role: "system", content: systemPrompt },
      ...validHistory,
      { role: "user", content: message }
    ];

    // Sort providers to prioritize Gemini, then fallback to others
    const availableProviders = PROVIDERS.filter(p => keys[p.id as keyof typeof keys]);
    const geminiProvider = availableProviders.find(p => p.id === "gemini");
    const otherProviders = availableProviders.filter(p => p.id !== "gemini");
    const sortedProviders = geminiProvider ? [geminiProvider, ...otherProviders] : otherProviders;

    // Try providers in priority order
    for (const provider of sortedProviders) {
      const apiKeys = keys[provider.id as keyof typeof keys];
      if (!apiKeys || apiKeys.length === 0) continue;

      const modelId = modelOverrides[provider.id as keyof typeof modelOverrides] || provider.models[0];

      for (const apiKey of apiKeys) {
        try {
        const payload: Record<string, unknown> = {
          model: modelId,
          messages,
          temperature: 0.2, // Keep it deterministic and academic
          max_tokens: MAX_TOKENS, // Strict token limit for concise answers
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
              generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0.2 }
            }),
            signal: AbortSignal.timeout(15000), // Fast timeout for chat
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return NextResponse.json({ reply: text });

        } else {
          // Standard OpenAI-compatible format
          headers["Authorization"] = `Bearer ${apiKey}`;

          const res = await fetch(provider.baseUrl!, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000),
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;

          if (text) return NextResponse.json({ reply: text });
        }
      } catch (err) {
        console.warn(`[Tutor API] ${provider.id} failed with key:`, err instanceof Error ? err.message : err);
        continue; // Try next key
      }
    }
  }

    return NextResponse.json({ error: "Failed to generate a reply. Please try again later." }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
