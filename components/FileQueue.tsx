"use client";

import { FileText, FileCode2, FileType2, X, AlertTriangle } from "lucide-react";
import { formatBytes } from "@/lib/text-extractor";
import type { QueueItem } from "@/lib/types";

interface Props {
  items: QueueItem[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

function Icon({ format }: { format: string }) {
  if (format === "pdf")
    return <FileText className="h-5 w-5 text-red-500" />;
  if (format === "docx")
    return <FileCode2 className="h-5 w-5 text-blue-500" />;
  return <FileType2 className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />;
}

function stats(item: QueueItem): string {
  const d = item.extracted;
  if (!d) return formatBytes(item.sizeBytes);
  if (d.format === "pdf") return `${d.pageCount} page${d.pageCount === 1 ? "" : "s"} · ${d.wordCount.toLocaleString()} words`;
  if (d.format === "docx") return `${(d.paragraphCount ?? 0)} paragraphs · ${d.wordCount.toLocaleString()} words`;
  return `${(d.lineCount ?? 0)} lines · ${d.wordCount.toLocaleString()} words`;
}

export default function FileQueue({ items, onRemove, disabled }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Document Queue ({items.length})
        </h3>
      </div>
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand/[0.03]"
          >
            <Icon format={item.format} />
            <div className="min-w-0 flex-1">
              <p className="truncate max-w-xs text-sm font-medium text-zinc-900 dark:text-zinc-100" title={item.name}>
                {item.name}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>{stats(item)}</span>
                {item.status === "parsing" && (
                  <span className="animate-pulse-soft rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    parsing…
                  </span>
                )}
                {item.status === "error" && (
                  <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    <AlertTriangle size={10} /> {item.error ?? "failed"}
                  </span>
                )}
                {item.extracted?.flags.map((f) => (
                  <span
                    key={f}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  >
                    {f === "scanned"
                      ? "scanned / image-only"
                      : f === "low-text"
                        ? "little extractable text"
                        : f === "empty"
                          ? "empty file"
                          : f}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => !disabled && onRemove(item.id)}
              disabled={disabled}
              aria-label={`Remove ${item.name}`}
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
            >
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
