import { NextRequest, NextResponse } from "next/server";
import { clientIp, originAllowed, rateLimited } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  if (!originAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (await rateLimited(clientIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const keys = {
    gemini: process.env.GEMINI_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    groq: process.env.GROQ_API_KEY,
    sambanova: process.env.SAMBANOVA_API_KEY
  };

  const results: Record<string, any> = {};

  const fetchJson = async (url: string, headers?: HeadersInit) => {
    try {
      const res = await fetch(url, { headers });
      return await res.json();
    } catch (e: any) {
      return { error: e.message };
    }
  };

  if (keys.gemini) {
    results.gemini = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${keys.gemini}`);
  }
  if (keys.mistral) {
    results.mistral = await fetchJson('https://api.mistral.ai/v1/models', { 'Authorization': `Bearer ${keys.mistral}` });
  }
  if (keys.openrouter) {
    results.openrouter = await fetchJson('https://openrouter.ai/api/v1/models', { 'Authorization': `Bearer ${keys.openrouter}` });
  }
  if (keys.groq) {
    results.groq = await fetchJson('https://api.groq.com/openai/v1/models', { 'Authorization': `Bearer ${keys.groq}` });
  }
  if (keys.sambanova) {
    results.sambanova = await fetchJson('https://api.sambanova.ai/v1/models', { 'Authorization': `Bearer ${keys.sambanova}` });
  }

  return NextResponse.json({ success: true, models: results });
}
