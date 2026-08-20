import { describe, it, expect } from "vitest";
import { buildTutorContext, TUTOR_CONTEXT_MAX_CHARS } from "../lib/tutor-context";
import type { ReviewerData } from "../lib/types";

const baseReviewer: ReviewerData = {
  id: "r1",
  createdAt: 1,
  updatedAt: 1,
  engine: "ai",
  summary: {
    title: "Glycolysis",
    overview: "How glucose is broken down.",
    keyTakeaways: ["Occurs in the cytoplasm", "Produces 2 ATP net"],
    docCount: 1,
    totalPages: 5,
    totalWords: 500,
    targetStudyMinutes: 10,
  },
  topics: [
    {
      id: "tp1",
      title: "Glycolysis",
      summary: "The breakdown of glucose.",
      details: [
        { id: "d1", heading: "Steps", points: ["Glucose to G6P", "G6P to F6P"] },
      ],
    },
    {
      id: "tp2",
      title: "Fermentation",
      summary: "Anaerobic continuation.",
      details: [],
    },
  ],
  terms: [
    { id: "t1", term: "Cytoplasm", definition: "The fluid inside the cell." },
    { id: "t2", term: "ATP", definition: "The energy currency of the cell." },
  ],
  facts: [
    { formula: "2 ATP net", context: "per glucose molecule" },
  ],
  quizBank: [],
};

describe("buildTutorContext", () => {
  it("includes topics, details, terms, facts, and takeaways", () => {
    const ctx = buildTutorContext(baseReviewer);
    expect(ctx).toContain("Glycolysis");
    expect(ctx).toContain("Steps");
    expect(ctx).toContain("Glucose to G6P");
    expect(ctx).toContain("Fermentation");
    expect(ctx).toContain("Cytoplasm");
    expect(ctx).toContain("2 ATP net");
    expect(ctx).toContain("Occurs in the cytoplasm");
  });

  it("never truncates below TUTOR_CONTEXT_MAX_CHARS", () => {
    const big = buildTutorContext(baseReviewer);
    expect(big.length).toBeLessThanOrEqual(TUTOR_CONTEXT_MAX_CHARS);
  });

  it("falls back gracefully when topics/terms are empty", () => {
    const empty: ReviewerData = {
      ...baseReviewer,
      topics: [],
      terms: [],
      facts: [],
    };
    const ctx = buildTutorContext(empty);
    expect(ctx).toContain("(none)");
    expect(ctx).toContain("Glycolysis");
  });
});