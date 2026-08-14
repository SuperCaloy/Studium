"use client";

import { useState } from "react";
import { ChevronDown, FolderOpen, ChevronRight } from "lucide-react";
import type { TopicAccordion } from "@/lib/types";

export default function TopicsPanel({ topics }: { topics: TopicAccordion[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (topics.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No structured topics could be detected in the source text.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {topics.map((topic) => {
        const isOpen = !!open[topic.id];
        return (
          <div
            key={topic.id}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white transition dark:border-zinc-700 dark:bg-zinc-900"
          >
            <button
              onClick={() =>
                setOpen((prev) => ({ ...prev, [topic.id]: !prev[topic.id] }))
              }
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <FolderOpen
                size={18}
                className="shrink-0 text-brand"
              />
              <span className="flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {topic.title}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {topic.details.length} detail{topic.details.length === 1 ? "" : "s"}
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className="animate-fade-in border-t border-zinc-100 px-5 py-4 dark:border-zinc-800">
                <p className="mb-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {topic.summary}
                </p>
                <div className="space-y-3">
                  {topic.details.map((detail) => (
                    <div key={detail.id}>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
                        <ChevronRight size={12} /> {detail.heading}
                      </p>
                      <ul className="space-y-1.5 pl-1">
                        {detail.points.map((p, i) => (
                          <li
                            key={i}
                            className="text-sm text-zinc-700 dark:text-zinc-300"
                          >
                            • {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
