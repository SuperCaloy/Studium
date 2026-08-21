import type { NextRequest } from "next/server";
import type { ExtractedDocument, FileFormat } from "./types";

export const MAX_DOCS = 5;
export const MAX_TEXT_CHARS = 100000;
export const MAX_BODY_BYTES = 8 * 1024 * 1024;
export const MAX_TARGET = 70;
export const MIN_TARGET = 1;

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 15;
const RATE_TRACKER = new Map<string, { count: number; resetAt: number }>();

let upstashRatelimit: Ratelimit | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    upstashRatelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(RATE_MAX_PER_WINDOW, "60 s"),
    });
  }
} catch (e) {
  console.warn("Upstash setup failed", e);
}

let requestCount = 0;

export async function rateLimited(key: string): Promise<boolean> {
  if (upstashRatelimit) {
    try {
      const { success } = await upstashRatelimit.limit(key);
      return !success;
    } catch (e) {
      // fallback on error
    }
  }

  requestCount++;
  const now = Date.now();

  // Lazy cleanup to avoid memory leaks in long-running processes
  if (requestCount % 100 === 0) {
    for (const [k, v] of RATE_TRACKER.entries()) {
      if (v.resetAt <= now) RATE_TRACKER.delete(k);
    }
    // Hard cap to prevent memory blowout from IP spoofing
    if (RATE_TRACKER.size > 1000) {
      let toDelete = RATE_TRACKER.size - 500;
      for (const [k] of RATE_TRACKER.entries()) {
        RATE_TRACKER.delete(k);
        toDelete--;
        if (toDelete <= 0) break;
      }
    }
  }

  const entry = RATE_TRACKER.get(key);
  if (!entry || entry.resetAt <= now) {
    RATE_TRACKER.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX_PER_WINDOW;
}

export function readKeys(base: string): string[] | undefined {
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

export function readSingleKey(base: string): string[] | undefined {
  const raw = process.env[base]?.trim();
  return raw ? [raw] : undefined;
}

export function readModel(base: string): string | undefined {
  return process.env[`${base}_MODEL`]?.trim() || undefined;
}

export function clientIp(req: NextRequest): string {
  // Vercel/Next.js edge directly provides req.ip
  const reqIp = (req as any).ip;
  if (reqIp) return reqIp;

  // Vercel's trusted proxy header for the actual client
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();

  // First entry of x-forwarded-for for deployments behind a trusted proxy
  // that does not set x-real-ip. Spoofable if no such proxy is present, but
  // still better than collapsing every client into one shared "unknown"
  // bucket on a bare `next start`.
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

export function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  // Trust the Host header only. x-forwarded-host is client-spoofable on
  // non-Vercel deploys and must not influence the CSRF comparison.
  const host = req.headers.get("host");

  if (!host) return false;

  if (!origin) {
    // Stricter CSRF: if origin is missing, check referer, deny if both missing.
    const referer = req.headers.get("referer");
    if (!referer) return false;
    try {
      const r = new URL(referer);
      return r.host === host;
    } catch {
      return false;
    }
  }

  try {
    const o = new URL(origin);
    return o.host === host;
  } catch {
    return false;
  }
}

export function sanitizeDocs(raw: unknown): ExtractedDocument[] | null {
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

export function buildProviderKeys(): {
  keys: {
    gemini: string[] | undefined;
    groq: string[] | undefined;
    openrouter: string[] | undefined;
    mistral: string[] | undefined;
    sambanova: string[] | undefined;
  };
  modelOverrides: Partial<Record<string, string>>;
} {
  return {
    keys: {
      gemini: readKeys("GEMINI_API_KEY"),
      groq: readSingleKey("GROQ_API_KEY"),
      openrouter: readSingleKey("OPENROUTER_API_KEY"),
      mistral: readSingleKey("MISTRAL_API_KEY"),
      sambanova: readSingleKey("SAMBANOVA_API_KEY"),
    },
    modelOverrides: {
      gemini: readModel("GEMINI"),
      groq: readModel("GROQ"),
      openrouter: readModel("OPENROUTER"),
      mistral: readModel("MISTRAL"),
      sambanova: readModel("SAMBANOVA"),
    },
  };
}
