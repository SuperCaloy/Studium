import { describe, it, expect } from "vitest";
import { assembleReviewer } from "../lib/ai-generator";

describe("Reviewer Generator", () => {
  it("should assemble a complete reviewer with valid fallback data when missing fields", () => {
    const docs = [
      { id: "1", name: "test.pdf", format: "pdf" as const, sizeBytes: 100, wordCount: 50, charCount: 300, text: "Sample text", flags: [] }
    ];
    
    const parts = {
      title: "Test Reviewer",
      overview: "Overview text"
    };

    const reviewer = assembleReviewer(docs, parts, undefined, []);

    expect(reviewer).toBeDefined();
    expect(reviewer.summary.title).toBe("Test Reviewer");
    expect(reviewer.summary.overview).toBe("Overview text");
    expect(reviewer.summary.keyTakeaways).toEqual([]);
    expect(reviewer.topics).toEqual([]);
    expect(reviewer.terms).toEqual([]);
    expect(reviewer.quizBank).toEqual([]);
    expect(reviewer.engine).toBe("ai");
  });

  it("should normalize topics and provide unique IDs", () => {
    const docs = [
      { id: "1", name: "test.pdf", format: "pdf" as const, sizeBytes: 100, wordCount: 50, charCount: 300, text: "Sample text", flags: [] }
    ];
    
    const parts = {
      topics: [
        {
          id: "",
          title: "Topic 1",
          summary: "Summary",
          details: [
            { id: "", heading: "Subheading", points: ["Point 1"] }
          ]
        }
      ]
    };

    const reviewer = assembleReviewer(docs, parts, undefined, []);

    expect(reviewer.topics).toHaveLength(1);
    expect(reviewer.topics[0].id).toBeTruthy();
    expect(reviewer.topics[0].id.length).toBeGreaterThan(5);
    expect(reviewer.topics[0].details[0].id).toBeTruthy();
  });
});
