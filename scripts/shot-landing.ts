import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const CHROME =
  "C:\\Users\\caloy\\AppData\\Local\\ms-playwright\\chromium-1217\\chrome-win64\\chrome.exe";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  writeFileSync("scripts/landing.png", await page.screenshot());
  console.log("landing light saved");

  await page.locator("button[aria-label='Toggle light/dark theme']").click();
  await page.waitForTimeout(800);
  writeFileSync("scripts/landing-dark.png", await page.screenshot());
  console.log("landing dark saved");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
