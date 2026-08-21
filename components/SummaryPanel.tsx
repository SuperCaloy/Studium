"use client";

import { FileText, Clock, FileStack, Type, Lightbulb } from "lucide-react";
import type { ReviewerData } from "@/lib/types";

export default function SummaryPanel({ reviewer }: { reviewer: ReviewerData }) {
  const s = reviewer.summary;

  const stats = [
    { icon: FileStack, label: "Documents", value: String(s.docCount) },
    { icon: Type, label: "Words", value: s.totalWords.toLocaleString() },
    {
      icon: FileText,
      label: "Pages",
      value: s.totalPages ? String(s.totalPages) : "-",
    },
    { icon: Clock, label: "Est. study time", value: `${s.targetStudyMinutes} min` },
  ];

  return (
    <section className="animate-fade-in space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {s.title}
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Compiled from {s.docCount} document{s.docCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((st) => (
          <div
            key={st.label}
            className="group rounded-xl border border-zinc-200 bg-white p-4 transition-all duration-300 hover:border-brand/40 hover:shadow-md hover:shadow-brand/[0.06] dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-brand/40"
          >
            <st.icon size={18} className="mb-2 text-brand transition-transform duration-300 group-hover:scale-110 group-hover:text-brand-dark dark:group-hover:text-brand-light" />
            <p className="text-xl font-bold tabular-nums tracking-tight text-zinc-900 transition-colors duration-300 group-hover:text-brand dark:text-zinc-50 dark:group-hover:text-brand-light">
              {st.value}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{st.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <Lightbulb size={16} className="text-amber-500" /> Executive Summary
        </h3>
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {s.overview}
        </p>
      </div>

      {s.keyTakeaways.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Lightbulb size={16} className="text-brand" /> Key Takeaways
          </h3>
          <ul className="space-y-2">
            {s.keyTakeaways.map((t, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
