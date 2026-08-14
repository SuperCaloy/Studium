"use client";

import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import type { TermDefinition } from "@/lib/types";

export default function Flashcards({ terms }: { terms: TermDefinition[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (terms.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No terms available for flashcard study.
      </p>
    );
  }

  const term = terms[index];

  const next = (dir: 1 | -1) => {
    setFlipped(false);
    setTimeout(() => {
      setIndex((i) => (i + dir + terms.length) % terms.length);
    }, 80);
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <button
          onClick={() => next(-1)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium transition hover:border-brand dark:border-zinc-700"
        >
          ← Previous
        </button>
        <span className="font-medium text-zinc-600 dark:text-zinc-300">
          Card {index + 1} of {terms.length}
        </span>
        <button
          onClick={() => next(1)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium transition hover:border-brand dark:border-zinc-700"
        >
          Next →
        </button>
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="block w-full"
        style={{ perspective: "1000px" }}
      >
        <div
          className="relative min-h-[200px] w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-center font-display text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {term.term}
            </p>
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center rounded-xl border border-brand/40 bg-brand/5 p-6"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <p className="text-center text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {term.definition}
            </p>
          </div>
        </div>
      </button>

      <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
        Click the card to flip between term and definition
      </p>

      <div className="flex justify-center">
        <button
          onClick={() => {
            setIndex(0);
            setFlipped(false);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-brand hover:text-brand dark:border-zinc-700 dark:text-zinc-300"
        >
          <RefreshCcw size={12} /> Restart
        </button>
      </div>
    </div>
  );
}
