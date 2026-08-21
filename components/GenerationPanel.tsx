"use client";

import {
  FileSearch,
  Lightbulb,
  BookMarked,
  ListChecks,
  CheckCircle2,
  X,
  Sparkles,
} from "lucide-react";
import type { GenerationProgress } from "@/lib/types";

const STEPS: {
  key: string;
  label: string;
  icon: typeof FileSearch;
}[] = [
  { key: "chunking", label: "Chunking", icon: FileSearch },
  { key: "topics", label: "Topics", icon: Lightbulb },
  { key: "terms", label: "Terms", icon: BookMarked },
  { key: "quiz", label: "Quiz", icon: ListChecks },
  { key: "done", label: "Done", icon: CheckCircle2 },
];

function activeIndex(p: GenerationProgress): number {
  if (p.step === "done") return STEPS.length - 1;
  if (p.step === "chunking") return 0;
  if (p.step === "extracting") {
    // Both topics and terms run during "extracting"; advance the pill once
    // terms start arriving so the user sees progress within the phase.
    return p.terms > 0 ? 2 : 1;
  }
  if (p.step === "building") return 3;
  return 0;
}

export default function GenerationPanel({
  progress,
  onCancel,
}: {
  progress: GenerationProgress;
  onCancel: () => void;
}) {
  const active = activeIndex(progress);

  const metrics = [
    { label: "Topics", value: progress.topics },
    { label: "Terms", value: progress.terms },
    { label: "Quiz questions", value: progress.quiz },
    {
      label: "Chunks",
      value:
        progress.chunksTotal > 0
          ? `${progress.chunksDone}/${progress.chunksTotal}`
          : "0/0",
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light">
            <Sparkles size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Building your study reviewer
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {progress.message}
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-500 transition hover:bg-red-50 hover:text-red-600 dark:border-red-900/50 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <X size={13} /> Cancel
        </button>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {progress.message}
          </span>
          <span className="font-semibold tabular-nums text-brand dark:text-brand-light">
            {progress.percent}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light transition-all duration-500"
            style={{ width: `${Math.max(4, Math.min(100, progress.percent))}%` }}
          />
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isDone = progress.step === "done" || i < active;
          const isActive = i === active && progress.step !== "done";
          return (
            <li
              key={step.key}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition ${
                isDone
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : isActive
                    ? "bg-brand/10 text-brand animate-pulse-soft dark:text-brand-light"
                    : "bg-zinc-50 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
              }`}
            >
              <Icon size={14} />
              <span className="truncate">{step.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-center dark:border-zinc-700 dark:bg-zinc-800/40"
          >
            <p className="text-lg font-bold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
              {m.value}
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}