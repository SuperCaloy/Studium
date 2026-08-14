"use client";

import { useState } from "react";
import {
  FileDown,
  Eye,
  Loader2,
} from "lucide-react";
import type { ReviewerData } from "@/lib/types";

interface Props {
  reviewer: ReviewerData;
}

export default function ExportBar({ reviewer }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);

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

  const handlePreview = () => {
    if (previewing) return;
    setPreviewing(true);
    fetch("/api/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewer }),
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const win = window.open(url, "_blank");
        if (!win) {
          window.location.href = url;
        }
      })
      .catch(() => {
        window.print();
      })
      .finally(() => {
        setPreviewing(false);
      });
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        onClick={handlePreview}
        disabled={previewing}
        className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-brand hover:text-brand active:scale-[0.98] disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        {previewing ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
        {previewing ? "Preparing preview..." : "Preview PDF"}
      </button>

      <button
        onClick={handleDownloadPdf}
        disabled={downloading}
        className="flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {downloading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
        {downloading ? "Preparing PDF..." : "Download PDF"}
      </button>
    </div>
  );
}
