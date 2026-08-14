import { chromium } from "playwright-core";
import { join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const EXE = "C:/Users/caloy/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe";
const PDF = "D:\\Project\\ReviewerGenerator\\scripts\\e2e-test-doc.pdf";
const OUT = join(process.cwd(), "scripts", "pdf-check.pdf");
const OUT_ZERO = join(process.cwd(), "scripts", "pdf-check-zero-margin.pdf");

const PAGE_W = 595.28; // A4 portrait, PDF points
const PAGE_H = 841.89;
const PT_TO_MM = 25.4 / 72;

const FOOTER_RE = /Page \d+ of \d+|Studium · study reviewer/;

interface TextItem {
  str: string;
  x: number;
  y: number;
  height: number;
}

async function measure(pdfPath: string) {
  const data = new Uint8Array(
    await (await import("node:fs/promises")).readFile(pdfPath)
  );
  const doc = await getDocument({ data }).promise;
  const perPage: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }[] = [];
  const all: string[] = [];
  let hasPageNumbers = false;
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await doc.getPage(i).then((p) => p.getTextContent());
    const items: TextItem[] = content.items
      .map((it) => {
        const tr = (it as { transform?: number[] }).transform ?? [];
        const str = (it as { str?: string }).str ?? "";
        return {
          str,
          x: tr[4] ?? 0,
          y: tr[5] ?? 0,
          height: (it as { height?: number }).height ?? 0,
        };
      })
      .filter((it) => it.str.trim().length > 0);
    const body = items.filter((it) => !FOOTER_RE.test(it.str));
    const left = Math.min(...body.map((it) => it.x));
    const right = Math.max(...body.map((it) => it.x));
    const top = Math.max(...body.map((it) => it.y + it.height));
    const bottom = Math.min(...body.map((it) => it.y));
    perPage.push({
      left: left * PT_TO_MM,
      right: (PAGE_W - right) * PT_TO_MM,
      top: (PAGE_H - top) * PT_TO_MM,
      bottom: bottom * PT_TO_MM,
    });
    const pageText = items.map((it) => it.str).join("");
    if (/Page \d+ of \d+/.test(pageText)) hasPageNumbers = true;
    all.push(pageText);
  }
  return {
    numPages: doc.numPages,
    perPage,
    all: all.join("\n---PAGE---\n"),
    hasPageNumbers,
  };
}

async function main() {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  await page.goto("http://localhost:3100", { waitUntil: "networkidle" });

  await page.locator('input[type="file"]').setInputFiles(PDF);
  await page.waitForTimeout(2500);
  await page.locator("button:has-text('Generate Study Reviewer')").click();
  await page.waitForSelector("button:has-text('Copy as Markdown')", { timeout: 120000 });
  console.log("reviewer ready");

  // Evaluate computed styles in print media (matches how page.pdf renders)
  await page.emulateMedia({ media: "print" });
  const designCss = await page.evaluate(() => {
    const panel = document.querySelector(".sr-panel");
    if (!panel) return "no print panel";
    const meta = panel.querySelector(".sr-doc-meta");
    const sectionH2 = panel.querySelector(".sr-section-heading h2");
    const sectionRule = panel.querySelector(".sr-section-heading .rule");
    const tableHead = panel.querySelector(".sr-table th");
    const row2 = panel.querySelector(".sr-table tbody tr:nth-child(2)");
    const cover = panel.querySelector(".sr-cover");
    const quiz = panel.querySelector(".sr-quiz-item");
    const callout = panel.querySelector(".sr-callout");
    return JSON.stringify({
      panelDisplay: panel ? getComputedStyle(panel).display : "missing",
      metaFont: meta ? getComputedStyle(meta).fontFamily : "missing",
      sectionHeadingFont: sectionH2 ? getComputedStyle(sectionH2).fontFamily : "missing",
      sectionRuleBg: sectionRule ? getComputedStyle(sectionRule).backgroundColor : "missing",
      tableHeadBg: tableHead ? getComputedStyle(tableHead).backgroundColor : "missing",
      evenRowTint: row2 ? getComputedStyle(row2).backgroundColor : "missing",
      cover: cover ? "present" : "missing",
      quiz: quiz ? "present" : "missing",
      callout: callout ? "present" : "missing",
    });
  });
  console.log("print styles:", designCss);

  // Run 1: normal page.pdf (default margins, preferCSSPageSize)
  await page.pdf({ path: OUT, preferCSSPageSize: true, printBackground: true });
  // Run 2: force zero page margins to prove baked-in padding survives
  await page.pdf({
    path: OUT_ZERO,
    preferCSSPageSize: true,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await browser.close();
  console.log("PDFs written:", OUT, OUT_ZERO);

  const m1 = await measure(OUT);
  const m2 = await measure(OUT_ZERO);
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const pages = m1.all.split("\n---PAGE---\n").filter(Boolean);
  const bodyStartOk =
    pages.length > 0 && norm(pages[0]).includes("executivesummary");
  const checks: [string, boolean, string][] = [
    ["content starts page 1 (no cover)", bodyStartOk, `pages=${pages.length}`],
    ["doc title on page 1", /e2e|test|doc|reviewer/i.test(norm(pages[0] ?? "")), `pages=${pages.length}`],
    ["section Executive Summary", /Executive Summary/.test(m1.all), "text"],
    ["section Topics", /Topics/.test(m1.all), "text"],
    ["section Terms & Definitions", /Terms & Definitions/.test(m1.all), "text"],
    ["section Key Facts & Formulas", /Key Facts & Formulas/.test(m1.all), "text"],
    ["Key Takeaways panel", /keytakeaways/.test(norm(m1.all)), "text"],
    ["Topic N labels", /topic\d/.test(norm(m1.all)), "text"],
    ["no quiz section", !/Practice Quiz/.test(m1.all), "text"],
    ["no cover page", !/Studium · study reviewer/.test(norm(pages[0])), "text"],
    ["page numbers present (normal)", m1.hasPageNumbers, "text"],
    ["page numbers present (zero-margin)", m2.hasPageNumbers, "text"],
    ["print panel visible in print media", /panelDisplay":"block"/.test(designCss), designCss],
    ["cover page removed from DOM", /cover":"missing"/.test(designCss), designCss],
    ["quiz removed from DOM", /quiz":"missing"/.test(designCss), designCss],
    ["key takeaways callout present", /callout":"present"/.test(designCss), designCss],
    ["big doc title removed from DOM", /"sr-doc-title"/.test(designCss) === false, designCss],
    ["section heading set in Georgia", /sectionHeadingFont":".*georgia/i.test(designCss), designCss],
    ["section heading rule in accent teal", /sectionRuleBg":"rgb\(31, 95, 90\)"/.test(designCss), designCss],
    ["table header in accent teal", /tableHeadBg":"rgb\(31, 95, 90\)"/.test(designCss), designCss],
    ["even rows stay white (no gray tint)", /evenRowTint":"rgb\(255, 255, 255\)"/.test(designCss), designCss],
    ["no em-dash", !/—/.test(m1.all), "text"],
    ["footer brand line", /Studium/.test(m1.all), "text"],
    ["page errors none", errors.length === 0, String(errors)],
  ];

  const allLeftOK1 = m1.perPage.every((p) => p.left >= 15);
  const allRightOK1 = m1.perPage.every((p) => p.right >= 15);
  const allTopOK1 = m1.perPage.every((p) => p.top >= 12);
  const allBottomOK1 = m1.perPage.every((p) => p.bottom >= 12);
  const allLeftOK2 = m2.perPage.every((p) => p.left >= 15);
  const allRightOK2 = m2.perPage.every((p) => p.right >= 15);
  const allTopOK2 = m2.perPage.every((p) => p.top >= 12);
  const allBottomOK2 = m2.perPage.every((p) => p.bottom >= 12);
  checks.push(
    ["left margin >= 15mm on all pages (normal)", allLeftOK1, JSON.stringify(m1.perPage)],
    ["right margin >= 15mm on all pages (normal)", allRightOK1, JSON.stringify(m1.perPage)],
    ["top margin >= 12mm on all pages (normal)", allTopOK1, JSON.stringify(m1.perPage)],
    ["bottom margin >= 12mm on all pages (normal)", allBottomOK1, JSON.stringify(m1.perPage)],
    ["left margin >= 15mm on all pages (zero-margin run)", allLeftOK2, JSON.stringify(m2.perPage)],
    ["right margin >= 15mm on all pages (zero-margin run)", allRightOK2, JSON.stringify(m2.perPage)],
    ["top margin >= 12mm on all pages (zero-margin run)", allTopOK2, JSON.stringify(m2.perPage)],
    ["bottom margin >= 12mm on all pages (zero-margin run)", allBottomOK2, JSON.stringify(m2.perPage)]
  );

  console.log("margins (normal):", JSON.stringify(m1.perPage));
  console.log("margins (zero-margin):", JSON.stringify(m2.perPage));

  for (const [name, pass, detail] of checks) {
    console.log(`${pass ? "PASS" : "FAIL"}: ${name}${detail !== "text" ? " (" + detail + ")" : ""}`);
  }
  const failed = checks.filter((c) => !c[1]);
  console.log(`\n${checks.length - failed.length}/${checks.length} pdf checks passed`);
  if (failed.length) {
    console.log(m1.all.slice(0, 1500));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});