import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const CHROME =
  "C:/Users/caloy/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const txtPath = join(process.cwd(), "scripts", "geo-check-note.txt");

const results: { name: string; pass: boolean; detail?: string }[] = [];
const record = (name: string, pass: boolean, detail?: string) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}: ${name}${detail ? " - " + detail : ""}`);
};

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();

  // Desktop: left hero column and right upload column must share the same top edge
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const heroTop = await page
    .locator("h2:has-text('Upload your notes')")
    .evaluate((el) => el.closest("section")?.getBoundingClientRect().top ?? -1);
  const dropTop = await page
    .locator("text=Drag & drop your study materials")
    .evaluate((el) => (el.closest("div[class*='border-2']") as HTMLElement).getBoundingClientRect().top);
  record(
    "desktop 1440: hero top aligns with dropzone top",
    Math.abs(heroTop - dropTop) < 2,
    `hero=${heroTop.toFixed(1)} dropzone=${dropTop.toFixed(1)}`
  );

  // Capture hero top before adding a file, then after adding one the hero must not move
  const heroTopBefore = await page
    .locator("h2:has-text('Upload your notes')")
    .evaluate((el) => el.getBoundingClientRect().top);

  writeFileSync(txtPath, "The mitochondria is the powerhouse of the cell. Glycolysis is the first stage of cellular respiration.");
  await page.setInputFiles('input[type="file"]', txtPath);
  await page.waitForSelector("text=Document Queue");
  await page.waitForTimeout(600);

  const heroTopAfter = await page
    .locator("h2:has-text('Upload your notes')")
    .evaluate((el) => el.getBoundingClientRect().top);
  record(
    "desktop: hero stays fixed when a file is added",
    Math.abs(heroTopAfter - heroTopBefore) < 2,
    `before=${heroTopBefore.toFixed(1)} after=${heroTopAfter.toFixed(1)}`
  );

  // Mobile: no horizontal overflow and hero/queue share the same left edge
  for (const width of [375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    record(`mobile ${width}: no horizontal overflow`, overflow <= 1, `overflow=${overflow}px`);
  }

  await page.setViewportSize({ width: 375, height: 844 });
  await page.waitForTimeout(400);
  const heroLeft = await page
    .locator("h2:has-text('Upload your notes')")
    .evaluate((el) => el.closest("section")?.getBoundingClientRect().left ?? -1);
  const dropLeft = await page
    .locator("text=Drag & drop your study materials")
    .evaluate((el) => (el.closest("div[class*='border-2']") as HTMLElement).getBoundingClientRect().left);
  record(
    "mobile: hero section and dropzone share the same left edge",
    Math.abs(dropLeft - heroLeft) < 2,
    `heroLeft=${heroLeft.toFixed(1)} dropLeft=${dropLeft.toFixed(1)}`
  );

  // The queue must sit below the dropzone (single-column stack), not beside it
  const dropBottom = await page
    .locator("text=Drag & drop your study materials")
    .evaluate((el) => (el.closest("div[class*='border-2']") as HTMLElement).getBoundingClientRect().bottom);
  const queueTop = await page
    .locator("text=Document Queue")
    .evaluate((el) => el.getBoundingClientRect().top);
  record(
    "mobile: Document Queue renders below dropzone",
    queueTop >= dropBottom,
    `dropBottom=${dropBottom.toFixed(1)} queueTop=${queueTop.toFixed(1)}`
  );

  // Regenerate screenshots at both breakpoints for eyeball confirmation
  await page.waitForTimeout(400);
  writeFileSync(join("scripts", "shot-landing-queue.png"), await page.screenshot());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  writeFileSync(join("scripts", "shot-landing-queue-desktop.png"), await page.screenshot());

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} geometry checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error("GEO CHECK ERROR:", e);
  process.exit(1);
});