import type { ReviewerData } from "./types";

export const TUTOR_CONTEXT_MAX_CHARS = 40000;

// Build a full-reviewer context so the tutor can answer from topics, facts,
// terms, and the summary - not just the summary + terms. This is the fix for
// the false "I cannot answer that based on the provided notes" replies when the
// requested content WAS in the notes but never reached the model's context.
export function buildTutorContext(reviewer: ReviewerData): string {
  const s = reviewer.summary;
  const topics = reviewer.topics
    .map(
      (t) =>
        `${t.title}: ${t.summary}${
          t.details?.length
            ? " " +
              t.details
                .map((d) => `${d.heading}: ${d.points.join("; ")}`)
                .join(" ")
            : ""
        }`
    )
    .join("\n");
  const facts = (reviewer.facts ?? [])
    .map((f) => `${f.formula} - ${f.context}`)
    .join("\n");
  const terms = reviewer.terms.map((t) => `${t.term}: ${t.definition}`).join("\n");

  const context = `
Title: ${s.title}
Overview: ${s.overview}
Key Takeaways: ${s.keyTakeaways.join("; ")}

Topics:
${topics || "(none)"}

Key Facts:
${facts || "(none)"}

Terms:
${terms || "(none)"}
  `;
  return context.trim().substring(0, TUTOR_CONTEXT_MAX_CHARS);
}