import { describe, it, expect } from "vitest";
import { migrateReviewer } from "@/lib/migrations";

const base = {
  id: "r1",
  createdAt: 1000,
  updatedAt: 2000,
  summary: {
    title: "t",
    overview: "o",
    keyTakeaways: ["k"],
    docCount: 1,
    totalPages: 1,
    totalWords: 100,
    targetStudyMinutes: 10,
  },
  topics: [],
  terms: [],
  facts: [],
  engine: "ai" as const,
};

describe("migrateReviewer", () => {
  it("returns null for non-object input", () => {
    expect(migrateReviewer(null)).toBeNull();
    expect(migrateReviewer("nope")).toBeNull();
  });

  it("returns null when quizBank is not an array", () => {
    expect(migrateReviewer({ ...base, quizBank: "x" })).toBeNull();
  });

  it("backfills missing conceptMap and version", () => {
    const out = migrateReviewer({ ...base, quizBank: [] });
    expect(out).not.toBeNull();
    expect(out!.conceptMap).toEqual({ isNeeded: false });
    expect(out!.version).toBe(2);
  });

  it("remaps colliding quiz ids sequentially", () => {
    const q = (id: number) => ({
      id,
      question: "q",
      options: ["a", "b"],
      correctAnswerIndex: 0,
      explanation: "e",
      difficulty: "easy",
    });
    const out = migrateReviewer({ ...base, quizBank: [q(0), q(0)] })!;
    expect(out.quizBank.map((x) => x.id)).toEqual([0, 1]);
  });

  it("normalizes a question missing difficulty to easy", () => {
    const out = migrateReviewer({
      ...base,
      quizBank: [
        {
          id: 0,
          question: "q",
          options: ["a", "b"],
          correctAnswerIndex: 0,
          explanation: "e",
        },
      ],
    })!;
    expect(out.quizBank[0].difficulty).toBe("easy");
  });

  it("keeps a current v2 reviewer intact", () => {
    const v2 = {
      ...base,
      version: 2,
      conceptMap: { isNeeded: true, mappings: [["a", "b", "c"]] },
      quizBank: [
        {
          id: 7,
          question: "q",
          options: ["a", "b"],
          correctAnswerIndex: 0,
          explanation: "e",
          difficulty: "hard",
        },
      ],
    };
    const out = migrateReviewer(v2)!;
    expect(out.version).toBe(2);
    expect(out.quizBank[0].id).toBe(7);
    expect(out.quizBank[0].difficulty).toBe("hard");
    expect(out.conceptMap).toEqual(v2.conceptMap);
  });
});
