import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { chromium as playwright } from "playwright-core";
import chromium from "@sparticuz/chromium-min";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PrintPanel from "@/components/PrintPanel";
import type { ReviewerData } from "@/lib/types";
import { MAX_BODY_BYTES, clientIp, originAllowed, rateLimited } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cachedCss: string | null = null;
function getCss() {
  if (cachedCss !== null) return cachedCss;
  try {
    cachedCss = readFileSync(join(process.cwd(), "app", "print.css"), "utf8");
    return cachedCss;
  } catch {
    return "";
  }
}

const DEFAULT_CHROMIUM_EXE =
  "C:/Users/caloy/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe";

async function getChromiumExecutable(): Promise<string> {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }
  
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    return DEFAULT_CHROMIUM_EXE;
  }
  
  return await chromium.executablePath(
    "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"
  );
}

function isValidReviewer(value: unknown): value is ReviewerData {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  const s = r.summary as Record<string, unknown> | undefined;
  if (!s || typeof s.title !== "string") return false;
  return (
    Array.isArray(r.topics) &&
    Array.isArray(r.terms) &&
    Array.isArray(r.quizBank) &&
    typeof r.updatedAt === "number"
  );
}

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
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const payload =
    body && typeof body === "object" && "reviewer" in body
      ? (body as { reviewer?: unknown }).reviewer
      : body;

  if (!isValidReviewer(payload)) {
    return NextResponse.json(
      { error: "Missing or invalid reviewer data." },
      { status: 400 }
    );
  }

  const css = getCss();
  if (!css) {
    return NextResponse.json(
      { error: "Print stylesheet unavailable." },
      { status: 500 }
    );
  }

  const { renderToStaticMarkup } = await import("react-dom/server");
  const markup = renderToStaticMarkup(
    createElement(PrintPanel, { reviewer: payload })
  );

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>${css}</style>
  </head>
  <body>
    ${markup}
  </body>
</html>`;

  let browser;
  try {
    const executablePath = await getChromiumExecutable();
    const isDev = process.env.NODE_ENV === "development" && executablePath === DEFAULT_CHROMIUM_EXE;

    browser = await playwright.launch({
      args: isDev ? [] : chromium.args,
      executablePath,
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
    });
    const filename = `${(payload.summary.title || "study-reviewer")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "study-reviewer"}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("PDF Export failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "PDF generation failed. Please try again." },
      { status: 500 }
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore close errors */
      }
    }
  }
}