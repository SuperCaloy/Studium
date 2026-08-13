"use client";

import {
  FileSearch,
  Layers,
  Lightbulb,
  ListChecks,
  CheckCircle2,
} from "lucide-react";
import type { GenerationProgress } from "@/lib/types";

const STEPS: {
  key: GenerationProgress["step"];
  label: string;
  icon: typeof FileSearch;
}[] = [
  { key: "parsing", label: "Parsing documents", icon: FileSearch },
  { key: "compiling", label: "Compiling text", icon: Layers },
  { key: "extracting", label: "Extracting concepts", icon: Lightbulb },
  { key: "building", label: "Building quiz bank", icon: ListChecks },
  { key: "done", label: "Done", icon: CheckCircle2 },
];

export default function ProgressSteps({ progress }: { progress: GenerationProgress }) {
  const activeIndex = STEPS.findIndex((s) => s.key === progress.step);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {progress.message}
          </span>
          <span className="font-semibold text-brand">{progress.percent}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light transition-all duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isDone = progress.step === "done" || i < activeIndex;
          const isActive = i === activeIndex && progress.step !== "done";
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
    </div>
  );
}
