"use client";

import { useState } from "react";
import { Copy, Check, FileDown, FileText } from "lucide-react";
import type { ReviewerData } from "@/lib/types";
import { copyText, downloadFile, reviewerToMarkdown } from "@/lib/export-utils";

interface Props {
  reviewer: ReviewerData;
}

export default function ExportBar({ reviewer }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(reviewerToMarkdown(reviewer));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadMd = () => {
    downloadFile(
      `${reviewer.summary.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "study-reviewer"}.md`,
      reviewerToMarkdown(reviewer),
      "text/markdown"
    );
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        onClick={handleCopy}
        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
          copied
            ? "bg-emerald-500 text-white"
            : "bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        }`}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Copied to clipboard!" : "Copy as Markdown"}
      </button>

      <button
        onClick={handleDownloadMd}
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-brand hover:text-brand dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        <FileText size={16} /> Download .md
      </button>

      <button
        onClick={handlePrintPdf}
        className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        <FileDown size={16} /> Export PDF
      </button>
    </div>
  );
}
