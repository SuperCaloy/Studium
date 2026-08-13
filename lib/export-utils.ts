import type { ReviewerData } from "./types";

function escapeMd(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function reviewerToMarkdown(reviewer: ReviewerData): string {
  const { summary, topics, terms, quizBank } = reviewer;
  const lines: string[] = [];

  lines.push(`# ${summary.title}`);
  lines.push("");
  lines.push(`_Generated reviewer. ${summary.docCount} document(s), ${summary.totalWords.toLocaleString()} words, ~${summary.targetStudyMinutes} min study time._`);
  lines.push("");

  lines.push("## Executive Summary");
  lines.push("");
  lines.push(summary.overview);
  lines.push("");

  lines.push("### Key Takeaways");
  lines.push("");
  for (const t of summary.keyTakeaways) {
    lines.push(`- ${t}`);
  }
  lines.push("");

  lines.push("## Topics");
  lines.push("");
  for (const topic of topics) {
    lines.push(`### ${topic.title}`);
    lines.push("");
    lines.push(topic.summary);
    lines.push("");
    for (const detail of topic.details) {
      lines.push(`**${detail.heading}**`);
      lines.push("");
      for (const point of detail.points) {
        lines.push(`- ${point}`);
      }
      lines.push("");
    }
  }

  lines.push("## Terms & Definitions");
  lines.push("");
  lines.push("| Term | Definition |");
  lines.push("| --- | --- |");
  for (const term of terms) {
    lines.push(`| ${escapeMd(term.term)} | ${escapeMd(term.definition)} |`);
  }
  lines.push("");

  lines.push("## Practice Quiz");
  lines.push("");
  quizBank.forEach((q, i) => {
    lines.push(
      `**${i + 1}. ${q.question}**${q.type === "tf" ? "  _(True/False)_" : ""}`
    );
    lines.push("");
    q.options.forEach((opt, oi) => {
      const marker = oi === q.correctAnswerIndex ? "[x]" : "[ ]";
      lines.push(`- ${marker} ${opt}`);
    });
    lines.push("");
    lines.push(`> ${q.explanation}`);
    lines.push("");
  });

  return lines.join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export async function downloadFile(
  name: string,
  content: string | Blob,
  mime: string
): Promise<void> {
  const blob =
    typeof content === "string"
      ? new Blob([content], { type: mime })
      : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
