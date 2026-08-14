import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PrintPanel from "@/components/PrintPanel";
import type { ReviewerData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_CHROMIUM_EXE =
  "C:/Users/caloy/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe";

const CHROMIUM_EXE = process.env.PLAYWRIGHT_CHROMIUM_PATH || DEFAULT_CHROMIUM_EXE;

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

  let css = "";
  try {
    css = readFileSync(join(process.cwd(), "app", "print.css"), "utf8");
  } catch {
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
    browser = await chromium.launch({ executablePath: CHROMIUM_EXE, headless: true });
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
  } catch {
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