"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, FileText, UploadCloud } from "lucide-react";

interface Props {
  onFiles: (files: File[]) => void;
  onLimitExceeded?: (ignoredNames: string[]) => void;
  onUnsupportedFiles?: (unsupportedNames: string[]) => void;
  disabled?: boolean;
}

export default function Dropzone({ onFiles, onLimitExceeded, onUnsupportedFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (list: FileList | File[]) => {
      const allFiles = Array.from(list);
      
      // Filter supported formats (.pdf, .docx, .txt)
      const supported: File[] = [];
      const unsupported: string[] = [];

      allFiles.forEach((f) => {
        const name = f.name.toLowerCase();
        if (name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".txt")) {
          supported.push(f);
        } else {
          unsupported.push(f.name);
        }
      });

      if (unsupported.length > 0 && onUnsupportedFiles) {
        onUnsupportedFiles(unsupported);
      }

      if (supported.length > 0) onFiles(supported);
    },
    [onFiles, onLimitExceeded, onUnsupportedFiles]
  );

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      role="button"
      aria-label="Upload PDF, DOCX, or TXT files"
      className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed p-8 text-center transition-all active:scale-[0.99] sm:p-12 ${
        disabled
          ? "pointer-events-none opacity-50"
          : dragging
            ? "scale-[1.01] border-brand bg-brand/[0.06]"
            : "border-brand/30 bg-white hover:border-brand hover:bg-brand/[0.04] dark:border-brand/40 dark:bg-zinc-900 dark:hover:border-brand"
      }`}
    >
      <div
        aria-hidden="true"
        className="paper-rule pointer-events-none absolute inset-0 opacity-70 dark:opacity-30"
      />
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="relative">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-brand/10 text-brand transition group-hover:scale-105 ${
            dragging ? "animate-pulse" : ""
          }`}
        >
          {dragging ? (
            <UploadCloud className="h-7 w-7" />
          ) : (
            <FileUp className="h-7 w-7" />
          )}
        </div>
        <h3 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {dragging ? "Release to add files" : "Drag & drop your study materials"}
        </h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Drop up to 5 <strong>PDF</strong>, <strong>DOCX</strong>, or{" "}
          <strong>TXT</strong> files.
        </p>
        <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition group-hover:bg-brand-dark">
          <FileText size={16} /> Browse files
        </span>
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          Files are processed entirely in your browser. Nothing is uploaded to a server.
        </p>
      </div>
    </div>
  );
}
