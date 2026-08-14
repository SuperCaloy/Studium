import type { ExtractedDocument, FileFormat } from "./types";

export const SUPPORTED_EXTENSIONS = ["pdf", "docx", "txt"] as const;

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        const workerUrl = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        );
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.href;
      }
      return pdfjsLib;
    })();
  }
  return pdfjsPromise;
}

export function getFormat(fileName: string): FileFormat | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "txt") return "txt";
  return null;
}

export function isSupported(fileName: string): boolean {
  return getFormat(fileName) !== null;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countWords(text: string): number {
  const m = text.match(/\b[\w'-]+\b/g);
  return m ? m.length : 0;
}

async function extractPdf(file: File): Promise<{
  text: string;
  pageCount: number;
  charCount: number;
  wordCount: number;
  flags: string[];
}> {
  const pdfjsLib = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  // Ensure arrayBuffer is safely copied to Uint8Array for PDF.js across mobile browsers
  const uint8Array = new Uint8Array(arrayBuffer);
  const pdf = await pdfjsLib.getDocument({
    data: uint8Array,
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
  }).promise;
  const pageCount = pdf.numPages;
  const parts: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let line = "";
    for (const item of content.items) {
      if ("str" in item) {
        const y = Math.round((item as { transform: number[] }).transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 3) {
          if (line.trim()) parts.push(line.trim());
          line = "";
        }
        line += (item as { str: string }).str + " ";
        lastY = y;
      }
    }
    if (line.trim()) parts.push(line.trim());
    parts.push("\n\n");
  }

  const text = normalizeText(parts.join("\n"));
  const charCount = text.replace(/\s/g, "").length;
  const flags: string[] = [];

  const avgCharsPerPage = pageCount > 0 ? charCount / pageCount : 0;
  if (avgCharsPerPage < 20) {
    flags.push("scanned");
  } else if (avgCharsPerPage < 80) {
    flags.push("low-text");
  }

  return { text, pageCount, charCount, wordCount: countWords(text), flags };
}

async function extractDocx(file: File): Promise<{
  text: string;
  paragraphCount: number;
  charCount: number;
  wordCount: number;
  flags: string[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({
    arrayBuffer,
    buffer: arrayBuffer as unknown as Buffer,
  } as unknown as Parameters<typeof mammoth.extractRawText>[0]);
  const text = normalizeText(result.value);
  const charCount = text.replace(/\s/g, "").length;
  const flags: string[] = [];
  if (charCount < 100) flags.push("low-text");
  return {
    text,
    paragraphCount: text ? text.split(/\n\s*\n/).length : 0,
    charCount,
    wordCount: countWords(text),
    flags,
  };
}

async function extractTxt(file: File): Promise<{
  text: string;
  lineCount: number;
  charCount: number;
  wordCount: number;
  flags: string[];
}> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let text: string;
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = new TextDecoder("utf-16le").decode(buf);
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    text = new TextDecoder("utf-16be").decode(buf);
  } else {
    text = new TextDecoder("utf-8").decode(buf);
  }
  text = normalizeText(text);
  const charCount = text.replace(/\s/g, "").length;
  const flags: string[] = [];
  if (charCount === 0) flags.push("empty");
  else if (charCount < 100) flags.push("low-text");
  return {
    text,
    lineCount: text ? text.split("\n").length : 0,
    charCount,
    wordCount: countWords(text),
    flags,
  };
}

export async function extractText(file: File): Promise<ExtractedDocument> {
  const format = getFormat(file.name);
  if (!format) {
    throw new Error(`Unsupported file format: ${file.name}`);
  }

  const base = {
    id: crypto.randomUUID(),
    name: file.name,
    format,
    sizeBytes: file.size,
    wordCount: 0,
    charCount: 0,
    flags: [] as string[],
  };

  if (format === "pdf") {
    const { text, pageCount, charCount, wordCount, flags } = await extractPdf(
      file
    );
    return {
      ...base,
      text,
      pageCount,
      charCount,
      wordCount,
      flags,
    };
  }

  if (format === "docx") {
    const {
      text,
      paragraphCount,
      charCount,
      wordCount,
      flags,
    } = await extractDocx(file);
    return {
      ...base,
      text,
      paragraphCount,
      charCount,
      wordCount,
      flags,
    };
  }

  const { text, lineCount, charCount, wordCount, flags } = await extractTxt(
    file
  );
  return { ...base, text, lineCount, charCount, wordCount, flags };
}
