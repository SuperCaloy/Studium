import { chromium } from "playwright-core";
import PDFDocument from "pdfkit";
import { writeFileSync, readFileSync } from "node:fs";
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

  const chapters = [
    ["Chapter 1: Cellular Biology", "The cell is defined as the basic structural and functional unit of all living organisms. Every organism is composed of one or more cells. The cell theory is a fundamental principle of biology that states that all living things are composed of cells and that new cells are produced from existing cells. The nucleus is the membrane-bound organelle that contains the genetic material. The mitochondria is the organelle responsible for producing ATP through cellular respiration."],
    ["Chapter 2: Photosynthesis", "Photosynthesis is defined as the process by which green plants transform light energy into chemical energy. Photosynthesis occurs in the chloroplast, which contains the green pigment chlorophyll. Chlorophyll is the pigment that absorbs light energy. The overall equation for photosynthesis shows that carbon dioxide and water, in the presence of light, produce glucose and release oxygen. The summary equation of photosynthesis is 6CO2 + 6H2O = C6H12O6 + 6O2. The light-dependent reactions occur in the thylakoid membranes and produce ATP and NADPH. The Calvin cycle is the light-independent stage that fixes carbon dioxide into glucose."],
    ["Chapter 3: Cellular Respiration", "Cellular respiration is the process by which cells break down glucose to produce ATP. Cellular respiration consists of three main stages. Glycolysis occurs in the cytoplasm and is the first stage, during which glucose is broken down into two molecules of pyruvate. The Krebs cycle occurs in the mitochondrial matrix. The electron transport chain is the final stage and occurs on the inner mitochondrial membrane. Fermentation is the anaerobic process that regenerates NAD+ when oxygen is unavailable. The summary equation of cellular respiration is C6H12O6 + 6O2 = 6CO2 + 6H2O + ATP."],
    ["Chapter 4: Cell Transport", "The cell membrane is the selectively permeable barrier that controls what enters and leaves the cell. Diffusion is the passive movement of molecules from an area of high concentration to low concentration. Osmosis is defined as the diffusion of water across a selectively permeable membrane. Active transport is the movement of substances against their concentration gradient, requiring energy in the form of ATP. Endocytosis is the process by which the cell engulfs large particles by wrapping the membrane around them."],
    ["Chapter 5: DNA and Protein Synthesis", "DNA is defined as the molecule that carries the genetic instructions for the development and functioning of living organisms. DNA replication is the process by which a double-stranded DNA molecule is copied to produce two identical DNA molecules. Transcription is the process by which the DNA sequence of a gene is copied into messenger RNA. Translation is defined as the process by which the ribosome builds a protein from the mRNA sequence. Each three-nucleotide codon on mRNA specifies one amino acid. The genetic code is the set of rules by which information encoded in genetic material is translated into proteins."],
    ["Chapter 6: Cell Division", "Mitosis is the process of nuclear division that produces two genetically identical daughter cells. The cell cycle consists of interphase, mitosis, and cytokinesis. Interphase is the stage during which the cell grows, copies its DNA, and prepares for division. Prophase is the first stage of mitosis, during which chromosomes condense. Anaphase is the stage during which sister chromatids are pulled apart to opposite poles of the cell. Meiosis is defined as the specialized cell division that produces four genetically diverse haploid gametes."],
    ["Chapter 7: Genetics", "A gene is defined as the basic unit of heredity, a segment of DNA that codes for a specific trait. An allele is an alternative form of a gene at the same locus. The genotype is the genetic makeup of an organism, while the phenotype is its observable characteristics. A dominant allele is expressed when only one copy is present. A recessive allele is only expressed when two copies are present. Punnett squares are used to predict the probability of offspring inheriting particular traits."],
    ["Chapter 8: Enzymes", "An enzyme is defined as a protein that acts as a biological catalyst, speeding up chemical reactions without being consumed. The active site is the region of an enzyme where the substrate binds. The induced fit model describes how the enzyme changes shape to accommodate the substrate. Optimal temperature is the temperature at which an enzyme works fastest. Denaturation is defined as the loss of an enzyme's three-dimensional shape, which destroys its function."],
    ["Chapter 9: Homeostasis", "Homeostasis is defined as the maintenance of a stable internal environment despite external changes. Negative feedback is a mechanism that reverses a change, bringing the system back to its set point. Positive feedback amplifies a change and drives the system further from its set point. The normal human body temperature is maintained at approximately 37 degrees Celsius. Blood glucose concentration is regulated by the hormones insulin and glucagon. Insulin is secreted when blood glucose is high, promoting glucose uptake."],
    ["Chapter 10: Human Systems", "The circulatory system transports oxygen, nutrients, and waste products throughout the body. The heart is the muscular organ that pumps blood through the circulatory system. The respiratory system is responsible for gas exchange, bringing oxygen into the body and removing carbon dioxide. The nervous system coordinates rapid responses through electrical signals called nerve impulses. The endocrine system regulates long-term processes through chemical messengers called hormones."],
  ];
  for (const [title, body] of chapters) {
    doc.fontSize(14).text(title);
    doc.fontSize(11).text(body);
  }
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
  await page.waitForSelector("button:has-text('Copy as Markdown')", { timeout: 120000 });
  record("reviewer generated", true);

  // 2a) No technical error text surfaces in the client
  const bodyText = await page.evaluate(() => document.body.textContent || "");
  const leakPatterns = [
    "All AI providers failed",
    "Fetch failed",
    "Server responded with",
    "offline engine was used",
    "AI generation failed",
    "HTTP 4",
    "HTTP 5",
    "TypeError:",
    "AbortError",
  ];
  const leaked = leakPatterns.filter((p) => bodyText.includes(p));
  record("no technical error text in client", leaked.length === 0, leaked.join(" | "));

  // 2b) Key Facts tab (formulas extracted verbatim)
  await page.locator("button:has-text('Key Facts')").first().click();
  await page.waitForTimeout(500);
  const factMonos = await page.locator("p.font-mono").count().catch(() => 0);
  const hasEquation = bodyText.includes("6CO2 + 6H2O = C6H12O6 + 6O2");
  record("key facts panel shows formulas", factMonos >= 1 || hasEquation, `${factMonos} formula cells, equation=${hasEquation}`);
  await page.locator("button:has-text('Summary')").first().click();
  await page.waitForTimeout(300);

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
  await page.waitForSelector("button:has-text('Start Quiz')", { timeout: 15000 });
  const quizBtn = await page.locator("button:has-text('Start Quiz')").first().isVisible();
  record("quiz setup screen shown", quizBtn);

  // 6a) Target options are derived from the actual bank size (built up front, no regeneration needed)
  const setupBanner = await page
    .locator("text=/\\d+ questions available/")
    .first()
    .innerText()
    .catch(() => "");
  const bankSize = parseInt((setupBanner.match(/(\d+) questions available/) || [])[1] || "0");
  record("quiz bank size read from setup", bankSize > 0, `${bankSize} questions`);

  const maxAvailable = Math.min(70, bankSize);
  const expectedTargets = (() => {
    const base = [10, 20, 30, 50, 70].filter((n) => n <= maxAvailable);
    return base.length > 0 ? base : maxAvailable > 0 ? [maxAvailable] : [];
  })();
  const shownTargets: number[] = [];
  for (const btn of await page.locator("button").all()) {
    const txt = (await btn.textContent().catch(() => "") || "").trim();
    if (/^\d+$/.test(txt)) shownTargets.push(parseInt(txt));
  }
  const shownSet = new Set(shownTargets);
  const expectedSet = new Set(expectedTargets);
  const targetsMatch =
    shownTargets.length === expectedTargets.length &&
    expectedTargets.every((n) => shownSet.has(n)) &&
    [5, 10, 20, 30, 50, 70].filter((n) => !expectedSet.has(n)).every((n) => !shownSet.has(n));
  record("target options match bank size", targetsMatch, `bank=${bankSize} targets=[${shownTargets.join(",")}] expected=[${expectedTargets.join(",")}]`);

  // 6b) No regeneration prompt exists anywhere; Start Quiz is always enabled when the bank is non-empty
  const regenPrompt = await page
    .locator("button")
    .filter({ hasText: /Regenerate with/ })
    .count();
  const startEnabled = await page
    .locator("button:has-text('Start Quiz')")
    .first()
    .isEnabled()
    .catch(() => false);
  record("no regenerate prompt", regenPrompt === 0, `prompts=${regenPrompt}`);
  record("start enabled without regeneration", startEnabled, `enabled=${startEnabled}`);

  // 6c) Run a quiz at the largest available target to prove the bank holds the selection
  const pick = expectedTargets.includes(50) ? 50 : expectedTargets[expectedTargets.length - 1];
  if (startEnabled && pick > 0) {
    await page
      .locator("button")
      .filter({ hasText: new RegExp(`^${pick}$`) })
      .first()
      .click();
    await page.waitForTimeout(300);
    await page.locator("button:has-text('Start Quiz')").first().click();
    await page.waitForSelector("text=Question 1 of", { timeout: 10000 });
    const q1 = await page.locator("text=Question 1 of").innerText();
    const n1 = parseInt((q1.match(/of (\d+)/) || [])[1] || "0");
    record(`quiz runs with ${pick} questions`, n1 === pick, q1);
    await page.locator("button:has-text('Skip / reveal')").first().click();
    await page.waitForTimeout(150);
    for (let i = 1; i < n1; i++) {
      await page.locator("button:has-text('Next question')").click();
      await page.waitForTimeout(100);
      if (i < n1 - 1) {
        await page.locator("button:has-text('Skip / reveal')").click();
        await page.waitForTimeout(80);
      }
    }
    await page.locator("button:has-text('Skip / reveal')").click();
    await page.locator("button:has-text('Finish')").click();
    await page.waitForSelector("button:has-text('Change settings')", { timeout: 15000 });
    await page.locator("button:has-text('Change settings')").click();
    await page.waitForTimeout(300);
  } else {
    record(`quiz runs with ${pick} questions`, false, "Start Quiz disabled or no target");
  }

  // 6d) Pick the smallest target for the full-quiz run
  await page
    .locator("button")
    .filter({ hasText: new RegExp(`^${expectedTargets[0]}$`) })
    .first()
    .click();
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

  // 10) Download PDF via API
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }),
    page.locator("button:has-text('Download PDF')").click(),
  ]);
  const dlPath = join(process.cwd(), "scripts", "e2e-download-check.pdf");
  await download.saveAs(dlPath);
  const head = readFileSync(dlPath).subarray(0, 4).toString("latin1");
  record("download pdf via api", head === "%PDF", `${head} ${download.suggestedFilename()}`);

  // 11) Persistence across reload
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("button:has-text('Copy as Markdown')", { timeout: 20000 });
  const persistedQueue = await page.evaluate(() => document.body.textContent?.includes("e2e-test-doc.pdf") ?? false);
  record("state persists across reload (reviewer + queue)", persistedQueue);

  // 12) New session + docx/txt uploads + sample flow
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
  await page.waitForSelector("button:has-text('Copy as Markdown')", { timeout: 120000 });
  record("reviewer generates from docx + txt", true);

  await page.locator("button:has-text('New session')").click();
  await page.waitForTimeout(500);
  await page.locator("button:has-text('Sample')").click();
  await page.waitForSelector("button:has-text('Copy as Markdown')", { timeout: 120000 });
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
