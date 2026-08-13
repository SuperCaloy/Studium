import { chromium } from "playwright-core";
import PDFDocument from "pdfkit";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME =
  "C:/Users/caloy/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe";
const BASE = "http://localhost:3100";
const pdfPath = join(process.cwd(), "scripts", "e2e-test-doc.pdf");

async function buildPdf() {
  const doc = new PDFDocument({ margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<void>((res) => doc.on("end", res));
  doc.fontSize(14).text("Chapter 1: Cellular Biology");
  doc.fontSize(11).text(
    "The cell is defined as the basic structural and functional unit of all living organisms. Every organism is composed of one or more cells. The cell theory is a fundamental principle of biology that states that all living things are composed of cells and that new cells are produced from existing cells."
  );
  doc.fontSize(14).text("Chapter 2: Photosynthesis");
  doc.fontSize(11).text(
    "Photosynthesis is defined as the process by which green plants transform light energy into chemical energy. Photosynthesis occurs in the chloroplast, which contains the green pigment chlorophyll. Chlorophyll is the pigment that absorbs light energy. The overall equation for photosynthesis shows that carbon dioxide and water, in the presence of light, produce glucose and release oxygen."
  );
  doc.fontSize(14).text("Chapter 3: Cellular Respiration");
  doc.fontSize(11).text(
    "Cellular respiration is the process by which cells break down glucose to produce ATP. Cellular respiration consists of three main stages. Glycolysis occurs in the cytoplasm and is the first stage, during which glucose is broken down into two molecules of pyruvate. The Krebs cycle occurs in the mitochondrial matrix. The electron transport chain is the final stage and occurs on the inner mitochondrial membrane."
  );
  doc.end();
  await done;
  writeFileSync(pdfPath, Buffer.concat(chunks));
}

const results: { name: string; pass: boolean; detail?: string }[] = [];
const record = (name: string, pass: boolean, detail?: string) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}: ${name}${detail ? " — " + detail : ""}`);
};

async function main() {
  await buildPdf();
  console.log("Test PDF written:", pdfPath);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: "networkidle" });

  record("app loads", (await page.title()).toLowerCase().includes("reviewer"));
  record(
    "dropzone visible",
    await page.locator("text=Drag & drop your study materials").isVisible()
  );

  // 1) Upload PDF, verify queue + extraction
  await page.setInputFiles('input[type="file"]', pdfPath);
  let words = 0;
  let statusShown = "";
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    statusShown = await page
      .evaluate(() => {
        const li = Array.from(document.querySelectorAll("li")).find((l) =>
          l.textContent?.includes("e2e-test-doc.pdf")
        );
        return li ? li.textContent || "" : "";
      })
      .catch(() => "");
    if (statusShown.includes("words")) {
      const m = statusShown.match(/([\d,]+) words/);
      words = m ? parseInt(m[1].replace(/,/g, "")) : 0;
      break;
    }
    if (statusShown.includes("error") || statusShown.includes("failed")) break;
  }
  record("PDF uploaded to queue", statusShown.includes("e2e-test-doc.pdf"));
  record("PDF pages + word stats shown", /pages?\s*·\s*[\d,]+ words/.test(statusShown), statusShown.replace(/\s+/g, " ").slice(0, 80));
  record("PDF full-text extracted (word count > 100)", words > 100, `${words} words`);

  // 2) Generate reviewer
  await page.locator("button:has-text('Generate Study Reviewer')").click();
  await page.waitForSelector("button:has-text('Copy as Markdown')", { timeout: 40000 });
  record("reviewer generated", true);

  // 3) Summary tab
  record(
    "executive summary shown",
    await page.locator("h3:has-text('Executive Summary')").first().isVisible()
  );

  // 4) Topics tab
  await page.locator("button:has-text('Topics')").first().click();
  await page.waitForTimeout(500);
  const topicCount = await page
    .locator("button")
    .filter({ hasText: /\d+ detail/ })
    .count();
  record("topic accordions present", topicCount >= 1, `${topicCount} topics`);

  // 5) Terms tab
  await page.locator("button:has-text('Terms')").first().click();
  await page.waitForTimeout(500);
  const termCells = await page.locator("td").count();
  record("terms table rendered", termCells >= 4, `${termCells} cells`);

  // 6) Quiz tab
  await page.locator("button:has-text('Quiz')").first().click();
  await page.waitForSelector("button:has-text('Start Quiz')", { timeout: 10000 });
  const quizBtn = await page.locator("button:has-text('Start Quiz')").first().isVisible();
  record("quiz setup screen shown", quizBtn);

  // 6a) All target options always visible regardless of bank size
  const targetBtns = await page
    .locator("button")
    .filter({ hasText: /^(10|20|30|50|70)$/ })
    .count();
  record("all target options visible", targetBtns >= 5, `${targetBtns} options`);

  // 6b) Picking a target larger than the bank triggers regeneration
  await page.locator("button:has-text('50')").first().click();
  await page.waitForSelector("button:has-text('Regenerate with 50 questions')", { timeout: 5000 });
  const regenBtn = await page
    .locator("button:has-text('Regenerate with 50 questions')")
    .isVisible();
  record("regenerate-with-50 prompt shown", regenBtn);
  await page.locator("button:has-text('Regenerate with 50 questions')").click();
  await page.waitForSelector("button:has-text('Regenerate with 50 questions')", {
    state: "detached",
    timeout: 120000,
  });
  await page.waitForTimeout(800);
  const availText = await page
    .locator("text=/Available: \\d+/")
    .first()
    .innerText()
    .catch(() => "");
  const available = parseInt((availText.match(/Available: (\d+)/) || [])[1] || "0");
  record("regeneration raised bank to target", available >= 50, `available=${available}`);

  // 6c) Restore original target for the full-quiz run
  await page.locator("button:has-text('20')").first().click();
  await page.waitForTimeout(300);

  // 7) Run a full quiz through answer + finish
  await page.locator("button:has-text('Start Quiz')").click();
  await page.waitForSelector("text=Question 1 of", { timeout: 10000 });
  const totalText = await page.locator("text=Question 1 of").innerText();
  const qTotal = parseInt((totalText.match(/of (\d+)/) || [])[1] || "0");
  record("quiz running with randomized questions", qTotal >= 10, totalText);

  await page.locator("button:has-text('Skip / reveal')").click();
  const feedback =
    (await page.locator("text=Correct!").count()) > 0 ||
    (await page.locator("text=Not quite").count()) > 0;
  record("quiz instant feedback", feedback);

  // answer all remaining questions via Skip / reveal (auto-answers correctly)
  for (let i = 1; i < qTotal; i++) {
    await page.locator("button:has-text('Next question')").click();
    await page.waitForTimeout(200);
    if (i < qTotal - 1) {
      await page.locator("button:has-text('Skip / reveal')").click();
      await page.waitForTimeout(100);
    }
  }
  await page.locator("button:has-text('Skip / reveal')").click();
  await page.locator("button:has-text('Finish')").click();
  await page.waitForSelector("button:has-text('Retake (reshuffled)')", { timeout: 15000 });
  const scoreText = await page.locator("text=/\\d+ \\/ \\d+/").first().innerText().catch(() => "");
  record("quiz completion + score screen", scoreText.length > 0, scoreText);

  // 8) Theme toggle
  const html = page.locator("html");
  const before = await html.getAttribute("class");
  await page.locator("button[aria-label='Toggle light/dark theme']").click();
  await page.waitForTimeout(400);
  const after = await html.getAttribute("class");
  record("theme toggle works", before !== after, `${before} -> ${after}`);

  // 9) Markdown copy
  await page.locator("button:has-text('Copy as Markdown')").click();
  await page.waitForSelector("text=Copied to clipboard!", { timeout: 5000 });
  record("markdown copy works", true);

  // 10) Persistence across reload
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("button:has-text('Copy as Markdown')", { timeout: 20000 });
  const persistedQueue = await page.evaluate(() => document.body.textContent?.includes("e2e-test-doc.pdf") ?? false);
  record("state persists across reload (reviewer + queue)", persistedQueue);

  // 11) New session + docx/txt uploads + sample flow
  await page.locator("button:has-text('New session')").click();
  await page.waitForTimeout(500);

  // Build and upload a .docx and a .txt file
  const docxPath = join(process.cwd(), "scripts", "e2e-test-doc.docx");
  const txtPath = join(process.cwd(), "scripts", "e2e-test-note.txt");
  writeFileSync(
    txtPath,
    "Cellular Respiration\nThe mitochondria is the powerhouse of the cell. Glycolysis is the first stage of cellular respiration. Fermentation occurs when oxygen is unavailable."
  );
  await page.setInputFiles('input[type="file"]', [docxPath, txtPath]);
  await page.waitForTimeout(4000);

  const txtStats = await page
    .evaluate(() => {
      const li = Array.from(document.querySelectorAll("li")).find((l) =>
        l.textContent?.includes("e2e-test-note.txt")
      );
      return li ? li.textContent || "" : "";
    })
    .catch(() => "");
  const docxStats = await page
    .evaluate(() => {
      const li = Array.from(document.querySelectorAll("li")).find((l) =>
        l.textContent?.includes("e2e-test-doc.docx")
      );
      return li ? li.textContent || "" : "";
    })
    .catch(() => "");
  record(
    "docx uploads with word stats",
    /paragraphs?\s*·\s*[\d,]+ words/.test(docxStats),
    docxStats.replace(/\s+/g, " ").slice(0, 80)
  );
  record(
    "txt uploads with line stats",
    /lines?\s*·\s*[\d,]+ words/.test(txtStats),
    txtStats.replace(/\s+/g, " ").slice(0, 80)
  );

  await page.locator("button:has-text('Generate Study Reviewer')").click();
  await page.waitForSelector("button:has-text('Copy as Markdown')", { timeout: 40000 });
  record("reviewer generates from docx + txt", true);

  await page.locator("button:has-text('New session')").click();
  await page.waitForTimeout(500);
  await page.locator("button:has-text('Sample')").click();
  await page.waitForSelector("button:has-text('Copy as Markdown')", { timeout: 40000 });
  record("sample material generates reviewer", true);

  record("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error("E2E ERROR:", e);
  process.exit(1);
});
