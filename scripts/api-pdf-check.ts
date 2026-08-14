import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const BASE = process.env.PDF_API_BASE || "http://localhost:3100";
const OUT = join(process.cwd(), "scripts", "api-pdf-check.pdf");
const PAGE_W = 595.28; // A4 portrait, PDF points
const PAGE_H = 841.89;
const PT_TO_MM = 25.4 / 72;
const FOOTER_RE = /Page \d+ of \d+|Study Reviewer Generator/;

const reviewer = {
  id: "api-check-fixture",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  engine: "offline",
  summary: {
    title: "Microbiology Midterm Reviewer",
    overview:
      "A focused reviewer covering cell structure, bacterial classification, and metabolism for the upcoming examination.",
    keyTakeaways: ["Gram staining separates bacteria by cell wall", "Aerobic respiration yields more ATP than fermentation", "Organelles compartmentalize eukaryotic metabolism"],
    docCount: 3,
    totalPages: 42,
    totalWords: 8450,
    targetStudyMinutes: 38,
  },
  topics: [
    {
      id: "t1",
      title: "Cell Wall & Membrane",
      summary: "Structural layers that define prokaryotic and eukaryotic boundaries.",
      details: [
        {
          id: "t1-d1",
          heading: "Peptidoglycan Layer",
          points: ["Thick in Gram-positive, thin in Gram-negative", "Cross-linked by peptide bridges"],
        },
      ],
    },
    {
      id: "t2",
      title: "Metabolic Pathways",
      summary: "Energy-generating routes central to microbial growth.",
      details: [
        {
          id: "t2-d1",
          heading: "Glycolysis",
          points: ["Converts glucose to pyruvate", "Yields 2 ATP per molecule"],
        },
      ],
    },
  ],
  terms: [
    { id: "term-1", term: "Aerobe", definition: "An organism that requires oxygen for growth." },
    { id: "term-2", term: "Fermentation", definition: "Anaerobic ATP generation without an electron transport chain." },
    { id: "term-3", term: "Plasmid", definition: "Small circular extrachromosomal DNA." },
  ],
  facts: [
    { formula: "ATP = C10H16N5O13P3", context: "Adenosine triphosphate" },
    { formula: "ΔG°' = -RT ln Keq", context: "Standard free-energy change" },
  ],
  quizBank: [
    {
      id: 1,
      type: "mcq",
      question: "Which structure is thickest in Gram-positive bacteria?",
      options: ["Peptidoglycan", "Lipopolysaccharide", "Outer membrane", "Capsule"],
      correctAnswerIndex: 0,
      explanation: "Gram-positive cells have a thick peptidoglycan layer.",
      difficulty: "easy",
    },
    {
      id: 2,
      type: "tf",
      question: "Fermentation requires oxygen.",
      options: ["True", "False"],
      correctAnswerIndex: 1,
      explanation: "Fermentation is an anaerobic process.",
      difficulty: "easy",
    },
  ],
};

interface TextItem {
  str: string;
  x: number;
  y: number;
  height: number;
}

async function measure(buf: Uint8Array) {
  const doc = await getDocument({ data: buf }).promise;
  const perPage: { left: number; right: number; top: number; bottom: number }[] = [];
  const all: string[] = [];
  let hasPageNumbers = false;
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await doc.getPage(i).then((p) => p.getTextContent());
    const items: TextItem[] = content.items
      .map((it) => {
        const tr = (it as { transform?: number[] }).transform ?? [];
        const str = (it as { str?: string }).str ?? "";
        return { str, x: tr[4] ?? 0, y: tr[5] ?? 0, height: (it as { height?: number }).height ?? 0 };
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
  return { numPages: doc.numPages, perPage, all: all.join("\n---PAGE---\n"), hasPageNumbers };
}

async function main() {
  const checks: [string, boolean, string][] = [];

  // 1. Valid POST -> 200 + application/pdf
  let res = await fetch(`${BASE}/api/export-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewer }),
  });
  checks.push(["POST returns 200", res.status === 200, String(res.status)]);
  const contentType = res.headers.get("content-type") || "";
  checks.push(["content-type is application/pdf", contentType.includes("application/pdf"), contentType]);
  checks.push(["content-disposition attachment", /attachment; filename="[^"]+\.pdf"/.test(res.headers.get("content-disposition") || ""), res.headers.get("content-disposition") || ""]);

  const buf = new Uint8Array(await res.arrayBuffer());
  writeFileSync(OUT, buf);

  // 2. Invalid body -> 400
  let bad = await fetch(`${BASE}/api/export-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewer: { nope: true } }),
  });
  checks.push(["invalid body returns 400", bad.status === 400, String(bad.status)]);

  // 3. PDF validity + content
  let m;
  try {
    m = await measure(buf);
  } catch {
    checks.push(["pdf parses with pdfjs", false, "parse failed"]);
    m = { numPages: 0, perPage: [], all: "", hasPageNumbers: false };
  }
  checks.push(["pdf parses with pdfjs", m.numPages > 0, `${m.numPages} pages`]);
  checks.push(["page numbers present", m.hasPageNumbers, "text"]);

  const pages = m.all.split("\n---PAGE---\n").filter(Boolean);
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  checks.push(["body starts page 1 (no cover)", pages.length > 0 && norm(pages[0]).includes("executivesummary"), `pages=${pages.length}`]);
  checks.push(["title header on page 1", pages.length > 0 && /reviewer/.test(norm(pages[0])), `pages=${pages.length}`]);
  checks.push(["Topics section present", norm(m.all).includes("topics"), "text"]);
  checks.push(["Terms table present", norm(m.all).includes("terms&definitions"), "text"]);
  checks.push(["Key Facts table present", norm(m.all).includes("keyfacts&formulas"), "text"]);
  checks.push(["no quiz section", !/Practice Quiz/.test(m.all), "text"]);
  checks.push(["no cover stats tiles", !/Min Study/.test(m.all), "text"]);
  checks.push(["no em-dash", !/—/.test(m.all), "text"]);

  const marginsOK = m.numPages > 0 && m.perPage.every((p) => p.left >= 15 && p.right >= 15 && p.top >= 12 && p.bottom >= 12);
  checks.push(["margins >= 15/15/12/12mm on all pages", marginsOK, JSON.stringify(m.perPage)]);

  console.log("PDF written:", OUT, `(${m.numPages} pages, ${buf.length} bytes)`);
  for (const [name, pass, detail] of checks) {
    console.log(`${pass ? "PASS" : "FAIL"}: ${name}${detail !== "text" ? " (" + detail + ")" : ""}`);
  }
  const failed = checks.filter((c) => !c[1]);
  console.log(`\n${checks.length - failed.length}/${checks.length} api-pdf checks passed`);
  if (failed.length) {
    console.log(m.all.slice(0, 800));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});