import { describe, it, expect } from "vitest";
import { parseScenarioQuizPart } from "../lib/ai-generator";
import { buildQuiz, buildOfflineReviewer } from "../lib/reviewer-generator";
import type { ExtractedDocument } from "../lib/types";

describe("B1: AI quiz question ids", () => {
  it("should assign unique ids to scenario quiz questions", () => {
    const raw = JSON.stringify({
      scenarioQuestions: [
        { question: "Scenario question one?", options: ["a", "b", "c", "d"], correctAnswerIndex: 0, explanation: "Explanation one." },
        { question: "Scenario question two?", options: ["a", "b", "c", "d"], correctAnswerIndex: 1, explanation: "Explanation two." },
      ],
    });
    const part = parseScenarioQuizPart(raw);
    const questions = part.scenarioQuestions ?? [];
    const ids = questions.map((q) => q.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("B3: NOT-an-example question", () => {
  it("should mark the distractor (non-example) as the correct answer", () => {
    const text =
      "Aerobic exercise such as running, swimming, and cycling. " +
      "Common sorting algorithms such as Quick Sort, Merge Sort, and Bubble Sort.";
    const terms = [
      { id: "t1", term: "Glycolysis", definition: "Glycolysis is the metabolic process that breaks down glucose in the cytoplasm of cells." },
    ];
    const topics = [
      { id: "tp", title: "Aerobic Exercise", summary: "Aerobic exercise such as running, swimming, and cycling.", details: [] },
    ];

    const questions = buildQuiz(terms, topics, text, 100);
    const notExample = questions.find((q) => q.question.includes("NOT an example"));
    expect(notExample).toBeDefined();

    const correct = notExample!.options[notExample!.correctAnswerIndex];
    const match = notExample!.question.match(/NOT an example of (.+?)\?/);
    const subject = match?.[1];
    const sameListItems =
      subject === "Aerobic exercise"
        ? ["running", "swimming", "cycling"]
        : ["Quick Sort", "Merge Sort", "Bubble Sort"];

    expect(sameListItems).not.toContain(correct);
  });
});

describe("B2: offline fallback", () => {
  it("should build a complete offline reviewer usable as a streaming fallback", () => {
    const docs: ExtractedDocument[] = [
      {
        id: "1",
        name: "study.txt",
        format: "txt",
        sizeBytes: 500,
        wordCount: 90,
        charCount: 500,
        pageCount: 1,
        text:
          "Glycolysis is the process by which glucose is broken down in the cytoplasm. " +
          "Cellular respiration is the process of producing ATP from glucose. " +
          "Aerobic exercise such as running, swimming, and cycling. " +
          "Common sorting algorithms such as Quick Sort, Merge Sort, and Bubble Sort. " +
          "Photosynthesis such as the light reactions, the Calvin cycle, and photorespiration.",
        flags: [],
      },
    ];

    const reviewer = buildOfflineReviewer(docs, 70);

    expect(reviewer.engine).toBe("offline");
    expect(reviewer.topics.length).toBeGreaterThan(0);
    expect(reviewer.terms.length).toBeGreaterThan(0);
    expect(reviewer.quizBank.length).toBeGreaterThan(0);
  });
});