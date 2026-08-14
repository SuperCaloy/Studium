import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PrintPanel from "@/components/PrintPanel";
import type { ReviewerData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import chromiumHelper from "@sparticuz/chromium";

import { existsSync } from "node:fs";

const isLocal = process.env.NODE_ENV === "development";
const getLocalChromiumPath = () => {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const paths = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return "C:/Program Files/Google/Chrome/Application/chrome.exe";
};
const CHROMIUM_EXE = getLocalChromiumPath();

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
    browser = await chromium.launch({
      args: isLocal ? [] : chromiumHelper.args,
      executablePath: isLocal ? CHROMIUM_EXE : await chromiumHelper.executablePath(),
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
    return NextResponse.json(
      { error: "PDF generation failed. " + (err instanceof Error ? err.message : String(err)) },
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