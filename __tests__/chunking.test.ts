import { describe, it, expect } from 'vitest';
import { stripCodeBlocks, condenseDoc, chunkDocuments } from '../lib/ai-generator';
import type { ExtractedDocument } from '../lib/types';

describe('Chunking & Pre-filtering Edge Cases', () => {
  it('strips massive code blocks to optimize cost', () => {
    const smallCode = "```\nconst x = 1;\n```";
    const massiveCode = "```\n" + "const x = 1;\n".repeat(50) + "```";
    
    expect(stripCodeBlocks(smallCode)).toBe(smallCode);
    expect(stripCodeBlocks(massiveCode)).toContain("[Code block omitted for cost optimization");
    expect(stripCodeBlocks(massiveCode)).not.toContain("const x = 1;\nconst x = 1;");
  });

  it('condenseDoc uses hierarchy chunking for long documents (>150 lines)', () => {
    const filler = Array.from({ length: 60 }, (_, i) => `Filler line ${i}`).join('\n');
    const docText = `
# Introduction
${filler}
## Deep Dive
${filler}
# Conclusion
${filler}
    `.trim();
    
    const doc: ExtractedDocument = { id: "1", name: "test.md", text: docText, format: "txt", wordCount: 500, pageCount: 1, sizeBytes: 1000, charCount: 5000, flags: [] };
    const condensed = condenseDoc(doc);
    
    // Ensure headings were detected and preserved
    expect(condensed).toContain('# Introduction');
    expect(condensed).toContain('## Deep Dive');
    expect(condensed).toContain('# Conclusion');
    // Ensure actual content from within the chunks is preserved
    expect(condensed).toContain('Filler line 0');
  });

  it('condenseDoc falls back gracefully for headerless long documents', () => {
    const docText = Array.from({ length: 600 }, (_, i) => `Headerless line ${i}`).join('\n');
    const doc: ExtractedDocument = { id: "2", name: "test.md", text: docText, format: "txt", wordCount: 6000, pageCount: 1, sizeBytes: 10000, charCount: 50000, flags: [] };
    const condensed = condenseDoc(doc);
    
    expect(condensed).toContain('Headerless line 0'); // Top kept
    expect(condensed).toContain('Headerless line 599'); // Bottom kept
    expect(condensed).toContain('[... excerpted ...]'); // Cutoff warning
    // Ensure middle is stripped
    expect(condensed).not.toContain('Headerless line 300');
  });

  it('chunkDocuments covers the whole corpus with no truncation marker', () => {
    const filler = Array.from({ length: 40 }, (_, i) => `Section content ${i}`).join('\n');
    const docText = `
# Intro
${filler}
## Middle
${filler}
# End
${filler}
    `.trim();
    const doc: ExtractedDocument = { id: "1", name: "big.md", text: docText, format: "txt", wordCount: 2000, pageCount: 1, sizeBytes: 20000, charCount: 20000, flags: [] };

    const chunks = chunkDocuments([doc], 2000);
    expect(chunks.length).toBeGreaterThan(1);
    // Every chunk stays within the budget
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(2400);
    // No artificial truncation markers
    for (const c of chunks) expect(c.text).not.toContain('[... truncated for length ...]');
    // Labels carry the doc identity
    expect(chunks[0].label).toContain('big.md');
  });

  it('chunkDocuments hard-slices a single oversized section', () => {
    const docText = "# Only Section\n" + Array.from({ length: 200 }, (_, i) => `Long line ${i} text`.repeat(20)).join('\n');
    const doc: ExtractedDocument = { id: "2", name: "wide.md", text: docText, format: "txt", wordCount: 5000, pageCount: 1, sizeBytes: 30000, charCount: 30000, flags: [] };

    const chunks = chunkDocuments([doc], 2000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(2400);
  });

  it('chunkDocuments produces a single chunk for small docs', () => {
    const doc: ExtractedDocument = { id: "3", name: "small.txt", text: "The mitochondria is the powerhouse of the cell.", format: "txt", wordCount: 9, pageCount: 1, sizeBytes: 100, charCount: 55, flags: [] };
    const chunks = chunkDocuments([doc], 12000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toContain('powerhouse');
  });
});
