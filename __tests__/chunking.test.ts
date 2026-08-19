import { describe, it, expect } from 'vitest';
import { stripCodeBlocks, condenseDoc } from '../lib/ai-generator';
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
});
