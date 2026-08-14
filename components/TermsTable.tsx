"use client";

import { useMemo, useState } from "react";
import { Search, BookMarked } from "lucide-react";
import type { TermDefinition } from "@/lib/types";

export default function TermsTable({ terms }: { terms: TermDefinition[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return terms;
    return terms.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q)
    );
  }, [terms, query]);

  if (terms.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No terms detected in the source text.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${terms.length} terms…`}
          className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 outline-none transition focus:border-brand dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700">
        <ul className="divide-y divide-zinc-100 bg-white md:hidden dark:divide-zinc-800 dark:bg-zinc-900">
          {filtered.map((t) => (
            <li key={t.id} className="px-4 py-3">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {t.term}
              </p>
              {t.sourceDoc && (
                <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                  {t.sourceDoc}
                </p>
              )}
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t.definition}
              </p>
            </li>
          ))}
        </ul>

        <table className="hidden w-full text-left text-sm md:table">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80">
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Term
              </th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Definition
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className="border-b border-zinc-100 bg-white transition last:border-0 hover:bg-brand/5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <td className="px-5 py-3 align-top font-semibold text-zinc-900 dark:text-zinc-100">
                  {t.term}
                  {t.sourceDoc && (
                    <span className="mt-1 block text-[10px] font-normal text-zinc-400 dark:text-zinc-500">
                      {t.sourceDoc}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 align-top leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {t.definition}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 bg-white py-10 text-zinc-400 dark:bg-zinc-900">
            <BookMarked size={24} />
            <p className="text-sm">No matching terms</p>
          </div>
        )}
      </div>
    </div>
  );
}
