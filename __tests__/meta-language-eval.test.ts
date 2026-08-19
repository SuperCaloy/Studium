import { describe, it, expect } from 'vitest';

/**
 * Evaluates whether a given text contains forbidden robotic meta-language.
 * Returns an array of matched violations, or an empty array if clean.
 */
export function evaluateMetaLanguage(text: string): string[] {
  const metaPatterns = [
    /this (document|reviewer|guide|study pack|text) (covers|explores|will explore|discusses|explains|provides)/i,
    /in this (document|reviewer|guide|study pack|text)/i,
    /we will (explore|discuss|cover|learn|look at)/i,
    /let'?s (explore|discuss|cover|dive into|look at)/i,
    /the purpose of this/i,
    /this section (covers|discusses|will explain)/i,
    /here is a (summary|list|breakdown)/i,
    /the provided (document|text|files)/i,
    /as mentioned in/i
  ];

  const violations: string[] = [];
  for (const pattern of metaPatterns) {
    const match = text.match(pattern);
    if (match) {
      violations.push(match[0]);
    }
  }
  return violations;
}

describe('Zero Meta-Language Output Eval', () => {
  it('fails outputs containing robotic introductions', () => {
    const badText1 = "This document covers the basics of cellular biology.";
    const badText2 = "In this reviewer, we will explore mitochondrial function.";
    const badText3 = "Here is a summary of the provided text:";
    
    expect(evaluateMetaLanguage(badText1).length).toBeGreaterThan(0);
    expect(evaluateMetaLanguage(badText2).length).toBeGreaterThan(0);
    expect(evaluateMetaLanguage(badText3).length).toBeGreaterThan(0);
  });

  it('passes direct, authoritative synthesis', () => {
    const goodText1 = "Cellular biology is the study of cell structure and function.";
    const goodText2 = "Mitochondria produce ATP through cellular respiration.";
    const goodText3 = "Key Takeaway: Photosynthesis converts light energy into chemical energy.";
    
    expect(evaluateMetaLanguage(goodText1).length).toBe(0);
    expect(evaluateMetaLanguage(goodText2).length).toBe(0);
    expect(evaluateMetaLanguage(goodText3).length).toBe(0);
  });

  // Optional: A placeholder for a live LLM integration test
  it.skip('live LLM eval: verifies the actual prompt against an LLM', async () => {
    // 1. Send the updated buildTopicsPrompt + mock document to the LLM
    // 2. Extract the 'overview' and 'keyTakeaways' from the JSON response
    // 3. const violations = evaluateMetaLanguage(response.overview);
    // 4. expect(violations).toHaveLength(0);
  });
});
