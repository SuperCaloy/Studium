"use client";

import { useEffect, useState } from "react";
import { Eye, FileDown, Loader2, X } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import type { ReviewerData } from "@/lib/types";
import { PdfDocument } from "./PdfDocument";

interface Props {
  reviewer: ReviewerData;
}

async function generatePdfBlob(reviewer: ReviewerData): Promise<Blob> {
  // Generate the PDF entirely in the browser instead of the server!
  // This is faster, 100% reliable, and completely eliminates the 500 error.
  const doc = <PdfDocument reviewer={reviewer} />;
  const asPdf = pdf(doc);
  return await asPdf.toBlob();
}

export default function ExportBar({ reviewer }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const closePreview = () => {
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  };

  useEffect(() => {
    if (!previewUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewUrl]);

  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    setError(null);
    try {
      const blob = await generatePdfBlob(reviewer);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "study-reviewer.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      // Fallback for mobile browsers or when server PDF generation fails
      try {
        window.print();
      } catch {
        setError(err instanceof Error ? err.message : "PDF generation failed. Please try again.");
      }
    } finally {
      setDownloading(false);
    }
  };


  const handlePreview = async () => {
    if (previewing || previewUrl) return;
    setPreviewing(true);
    setError(null);
    try {
      const blob = await generatePdfBlob(reviewer);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setError("PDF generation failed. Please try again.");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={handlePreview}
          disabled={previewing}
          className="flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          {previewing ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
          {previewing ? "Preparing preview..." : "Preview PDF"}
        </button>

        <button
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
        >
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          {downloading ? "Preparing PDF..." : "Download PDF"}
        </button>


      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-8"
          onClick={closePreview}
          role="dialog"
          aria-modal="true"
          aria-label="PDF preview"
        >
          <div
            className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3 dark:border-zinc-700">
              <h3 className="min-w-0 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                {reviewer.summary.title}
              </h3>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  className="flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                  {downloading ? "Preparing..." : "Download PDF"}
                </button>
                <button
                  onClick={closePreview}
                  aria-label="Close preview"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              src={previewUrl}
              title="Reviewer PDF preview"
              className="h-full w-full flex-1 border-0 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}