import { extractText } from "../lib/text-extractor";
import JSZip from "jszip";
import { writeFileSync, readFileSync } from "node:fs";

async function makeDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter 1: The Atom</w:t></w:r></w:p>
    <w:p><w:r><w:t>The atom is defined as the smallest unit of matter that retains the properties of an element. Every atom consists of a nucleus and orbiting electrons.</w:t></w:r></w:p>
    <w:p><w:r><w:t>The proton is a positively charged particle found in the nucleus. The neutron is an uncharged particle also located in the nucleus.</w:t></w:r></w:p>
  </w:body>
</w:document>`
  );
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync("scripts/e2e-test-doc.docx", Buffer.from(buf));
  return Buffer.from(buf);
}

async function main() {
  const docx = await makeDocx();

  const file = {
    name: "e2e-test-doc.docx",
    size: docx.length,
    arrayBuffer: async () =>
      docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength) as ArrayBuffer,
  } as unknown as File;
  const doc = await extractText(file);
  console.log("=== DOCX ===");
  console.log("format:", doc.format);
  console.log("paragraphs:", doc.paragraphCount);
  console.log("words:", doc.wordCount);
  console.log("text:", JSON.stringify(doc.text.slice(0, 150)));
  const docxOk =
    doc.text.includes("atom is defined") && doc.paragraphCount >= 2 && doc.wordCount > 20;
  console.log(docxOk ? "DOCX PASS" : "DOCX FAIL");

  const txt = Buffer.from(
    "Cell Theory\nThe cell is the basic unit of life. The mitochondria is the powerhouse of the cell. Photosynthesis is the process by which plants make glucose."
  );
  const txtFile = {
    name: "notes.txt",
    size: txt.length,
    arrayBuffer: async () =>
      txt.buffer.slice(txt.byteOffset, txt.byteOffset + txt.byteLength) as ArrayBuffer,
  } as unknown as File;
  const tdoc = await extractText(txtFile);
  console.log("\n=== TXT ===");
  console.log("format:", tdoc.format);
  console.log("lines:", tdoc.lineCount, "words:", tdoc.wordCount);
  const txtOk = tdoc.text.includes("Photosynthesis") && tdoc.wordCount > 20;
  console.log(txtOk ? "TXT PASS" : "TXT FAIL");
  process.exit(docxOk && txtOk ? 0 : 1);
}

main().catch((e) => {
  console.error("ERR:", e);
  process.exit(1);
});
