"use client";

import { FlaskConical } from "lucide-react";
import type { Fact } from "@/lib/types";

export default function FactsPanel({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No key facts or formulas detected in the source text.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        Formulas, equations, units, and constants extracted from your source
        material.
      </p>
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
        <ul className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
          {facts.map((f, i) => (
            <li key={i} className="px-5 py-4">
              <p className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {f.formula}
              </p>
              {f.context && (
                <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {f.context}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
