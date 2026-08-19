import { describe, it, expect } from "vitest";
import { verifyReviewerAgainstSource } from "@/lib/verify";
import type { QuizQuestion, ReviewerData } from "@/lib/types";

const mkQ = (
  id: number,
  question: string,
  explanation = ""
): QuizQuestion => ({
  id,
  question,
  options: ["a", "b"],
  correctAnswerIndex: 0,
  explanation,
  difficulty: "easy",
});

const baseReviewer: ReviewerData = {
  id: "r",
  createdAt: 1,
  updatedAt: 1,
  summary: {
    title: "t",
    overview: "o",
    keyTakeaways: [],
    docCount: 1,
    totalPages: 0,
    totalWords: 0,
    targetStudyMinutes: 5,
  },
  topics: [],
  terms: [],
  facts: [],
  engine: "ai",
  quizBank: [],
};

const offlinePool = [
  mkQ(0, "Pool question A"),
  mkQ(1, "Pool question B"),
  mkQ(2, "Pool question C"),
];

describe("verifyReviewerAgainstSource", () => {
  it("replaces ungrounded questions and returns the unused pool", () => {
    const reviewer: ReviewerData = {
      ...baseReviewer,
      quizBank: [
        mkQ(0, "What is 12.5 km?", "explains 12.5km"),
        mkQ(1, "Grounded question"),
      ],
    };
    const res = verifyReviewerAgainstSource(
      reviewer,
      "The core concept is simple and grounded.",
      offlinePool
    );

    expect(res.replaced).toBe(1);
    expect(res.reviewer.quizBank).toHaveLength(2);

    const replacedQ = res.reviewer.quizBank.find((q) => q.id === 0)!;
    expect(["Pool question A", "Pool question B", "Pool question C"]).toContain(
      replacedQ.question
    );

    expect(res.pool.map((q) => q.question)).not.toContain(replacedQ.question);
    expect(res.reviewer.quizBank.find((q) => q.id === 1)!.question).toBe(
      "Grounded question"
    );
  });

  it("does not touch grounded questions", () => {
    const reviewer: ReviewerData = {
      ...baseReviewer,
      quizBank: [mkQ(0, "Grounded question")],
    };
    const res = verifyReviewerAgainstSource(reviewer, "plain text", offlinePool);
    expect(res.replaced).toBe(0);
    expect(res.pool).toHaveLength(offlinePool.length);
  });
});
