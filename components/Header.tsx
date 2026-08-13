"use client";

import { GraduationCap, FlaskConical } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

interface Props {
  onLoadSample: () => void;
}

export default function Header({ onLoadSample }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
            <GraduationCap size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-zinc-900 dark:text-zinc-50">
              Study Reviewer
              <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand dark:text-brand-light">
                Generator
              </span>
            </h1>
            <p className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:block">
              PDF, DOCX, TXT → summary, topics, terms and quiz
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onLoadSample}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600 transition hover:border-brand hover:text-brand dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-brand-light"
          >
            <FlaskConical size={14} /> Sample
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
