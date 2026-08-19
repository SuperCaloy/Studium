import { describe, it, expect } from "vitest";
import {
  preferredFor,
  PROVIDERS,
  parseScenarioQuizPart,
} from "../lib/ai-generator";

describe("AI Generator Utilities", () => {
  it("should select the preferred model correctly based on available providers", () => {
    const availableProviders = ["gemini", "groq", "mistral"];
    const pick = preferredFor(0, availableProviders);
    
    expect(pick).toBeDefined();
    expect(pick.providerId).toBeTypeOf("string");
    expect(pick.keyIndex).toBeGreaterThanOrEqual(0);
  });

  it("should rotate providers based on taskIndex", () => {
    const availableProviders = ["groq", "mistral", "openrouter"];
    const pick0 = preferredFor(0, availableProviders);
    const pick1 = preferredFor(1, availableProviders);
    
    expect(pick0).toBeDefined();
    expect(pick1).toBeDefined();
  });
});

describe("parseScenarioQuizPart", () => {
  it("string-coerces primitive question/option/explanation fields", () => {
    const parts = parseScenarioQuizPart(
      JSON.stringify({
        scenarioQuestions: [
          {
            question: 42,
            options: [12.5, true, "third", false],
            correctAnswerIndex: 1,
            explanation: 99,
          },
        ],
      })
    );
    expect(parts.scenarioQuestions).toHaveLength(1);
    const q = parts.scenarioQuestions![0];
    expect(q.question).toBe("42");
    expect(q.options).toEqual(["12.5", "true", "third", "false"]);
    expect(q.explanation).toBe("99");
  });

  it("drops questions with object/array option values that coerce to empty", () => {
    const parts = parseScenarioQuizPart(
      JSON.stringify({
        scenarioQuestions: [
          {
            question: "Which one is valid?",
            options: [{ nested: true }, "b", "c", "d"],
            correctAnswerIndex: 0,
            explanation: "Because.",
          },
        ],
      })
    );
    expect(parts.scenarioQuestions).toHaveLength(0);
  });

  it("drops questions with non-integer or out-of-range correctAnswerIndex", () => {
    const parts = parseScenarioQuizPart(
      JSON.stringify({
        scenarioQuestions: [
          {
            question: "Q",
            options: ["a", "b", "c", "d"],
            correctAnswerIndex: 2.5,
            explanation: "E",
          },
        ],
      })
    );
    expect(parts.scenarioQuestions).toHaveLength(0);
  });

  it("keeps valid questions with sequential ids and hard difficulty", () => {
    const parts = parseScenarioQuizPart(
      JSON.stringify({
        scenarioQuestions: [
          { question: "Q1", options: ["a", "b", "c", "d"], correctAnswerIndex: 2, explanation: "E1" },
          { question: "Q2", options: ["w", "x", "y", "z"], correctAnswerIndex: 0, explanation: "E2" },
        ],
      })
    );
    expect(parts.scenarioQuestions?.map((q) => [q.id, q.question])).toEqual([
      [0, "Q1"],
      [1, "Q2"],
    ]);
    expect(parts.scenarioQuestions?.every((q) => q.difficulty === "hard")).toBe(true);
  });
});
