"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  FileDown,
  FileText,
  Printer,
  Loader2,
} from "lucide-react";
import type { ReviewerData } from "@/lib/types";
import { copyText, downloadFile, reviewerToMarkdown } from "@/lib/export-utils";

interface Props {
  reviewer: ReviewerData;
}

export default function ExportBar({ reviewer }: Props) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewer }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "PDF generation failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "study-reviewer.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center">
      <button
        onClick={handleCopy}
        className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
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
        className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-brand hover:text-brand dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        <FileText size={16} /> Download .md
      </button>

      <button
        onClick={handleDownloadPdf}
        disabled={downloading}
        className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
      >
        {downloading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
        {downloading ? "Preparing PDF..." : "Download PDF"}
      </button>

      <button
        onClick={handlePrint}
        className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-brand hover:text-brand dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        <Printer size={16} /> Print
      </button>
    </div>
  );
}
