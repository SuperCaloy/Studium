"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Wand2,
  RefreshCcw,
  Loader2,
  Trash2,
  Sparkles,
  FileWarning,
  ShieldCheck,
  FileText,
  FolderOpen,
  BookMarked,
  Layers,
  ListChecks,
  FileDown,
  ChevronRight,
} from "lucide-react";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import FileQueue from "@/components/FileQueue";
import ProgressSteps from "@/components/ProgressSteps";
import Dashboard from "@/components/Dashboard";
import PrintPanel from "@/components/PrintPanel";
import { extractText, formatBytes } from "@/lib/text-extractor";
import { normalizeIds } from "@/lib/reviewer-generator";
import {
  clearAll,
  loadDocuments,
  loadLatestReviewer,
  removeDocument,
  saveDocuments,
  saveReviewer,
} from "@/lib/storage";
import type {
  ExtractedDocument,
  GenerationProgress,
  QueueItem,
  ReviewerData,
} from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const serializeDocs = (docs: ExtractedDocument[]) =>
  docs.map((d) => ({
    id: d.id,
    name: d.name,
    format: d.format,
    sizeBytes: d.sizeBytes,
    pageCount: d.pageCount,
    paragraphCount: d.paragraphCount,
    lineCount: d.lineCount,
    wordCount: d.wordCount,
    charCount: d.charCount,
    text: d.text,
    flags: d.flags,
  }));

const FEATURES = [
  { icon: FileText, title: "Executive summary", text: "Every key idea, up front" },
  { icon: FolderOpen, title: "Topic breakdowns", text: "Clear chapters for each subject" },
  { icon: BookMarked, title: "Terms & definitions", text: "Every term, defined and searchable" },
  { icon: Layers, title: "Flashcards", text: "Flip cards to lock it in" },
  { icon: ListChecks, title: "Randomized quiz", text: "Up to 70 questions, reshuffled each time" },
  { icon: FileDown, title: "Markdown & PDF export", text: "Export to Markdown or PDF" },
];

export default function Home() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [reviewer, setReviewer] = useState<ReviewerData | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [generating, setGenerating] = useState(false);
  const [questionTarget, setQuestionTarget] = useState(20);
  const [fallback, setFallback] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const generationToken = useRef(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  };

  useEffect(() => {
    const t = localStorage.getItem("reviewer-target");
    if (t) setQuestionTarget(Number(t) || 20);
  }, []);

  useEffect(() => {
    (async () => {
      const docs = await loadDocuments();
      setQueue(
        docs.map((d) => ({
          id: d.id,
          name: d.name,
          format: d.format,
          sizeBytes: d.sizeBytes,
          status: "ready",
          extracted: d,
        }))
      );
      const latest = await loadLatestReviewer();
      if (latest) {
        const { topics, terms } = normalizeIds(latest.topics ?? [], latest.terms ?? []);
        setReviewer({ ...latest, topics, terms, facts: latest.facts ?? [] });
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (hydrated) {
      const docs = queue
        .filter((q) => q.status === "ready" && q.extracted)
        .map((q) => q.extracted!);
      saveDocuments(docs);
    }
  }, [queue, hydrated]);

  useEffect(() => {
    localStorage.setItem("reviewer-target", String(questionTarget));
  }, [questionTarget]);

  const handleFiles = useCallback(
    (files: File[]) => {
      files.forEach(async (file) => {
        const duplicate = queue.some(
          (q) =>
            q.name.toLowerCase() === file.name.toLowerCase() &&
            q.sizeBytes === file.size
        );
        if (duplicate) {
          showNotice(`"${file.name}" is already in your queue`);
          return;
        }
        const item: QueueItem = {
          id: crypto.randomUUID(),
          name: file.name,
          format: "pdf",
          sizeBytes: file.size,
          status: "parsing",
        };
        const ext = file.name.toLowerCase().split(".").pop();
        if (["pdf", "docx", "txt"].includes(ext ?? "")) {
          item.format = ext as QueueItem["format"];
        }
        setQueue((q) => [...q, item]);

        try {
          const doc = await extractText(file);
          setQueue((q) =>
            q.map((x) =>
              x.id === item.id
                ? { ...x, status: "ready", extracted: doc }
                : x
            )
          );
        } catch (err) {
          setQueue((q) =>
            q.map((x) =>
              x.id === item.id
                ? {
                    ...x,
                    status: "error",
                    error: err instanceof Error ? err.message : "Failed to parse",
                  }
                : x
            )
          );
        }
      });
    },
    [queue]
  );

  const handleRemove = async (id: string) => {
    await removeDocument(id);
    setQueue((q) => q.filter((x) => x.id !== id));
  };

  const handleNewSession = async () => {
    generationToken.current++;
    await clearAll();
    setReviewer(null);
    setQueue([]);
    setFallback(false);
    setProgress(null);
    setGenerating(false);
  };

  async function runGeneration(docs: ExtractedDocument[]) {
    if (docs.length === 0) return;
    generationToken.current++;
    const token = generationToken.current;
    setGenerating(true);
    setFallback(false);
    setProgress({
      step: "parsing",
      percent: 12,
      message: "Parsing documents…",
    });
    await sleep(200);

    setProgress({
      step: "compiling",
      percent: 30,
      message: `Compiling text from ${docs.length} document${docs.length === 1 ? "" : "s"}…`,
    });
    await sleep(300);

    setProgress({
      step: "extracting",
      percent: 55,
      message: "Analyzing key concepts, topics, and terms…",
    });

    let result: ReviewerData | null = null;
    let usedFallback = false;
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docs: serializeDocs(docs),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `Server responded with ${res.status}.`);
      }
      const data = await res.json();
      if (token !== generationToken.current) return;
      result = data.reviewer;
      usedFallback = !!data.fallback;
    } catch (err) {
      if (token !== generationToken.current) return;
      console.error("Generation failed:", err);
      throw err;
    }

    if (!result) return;
    if (token !== generationToken.current) return;
    setReviewer(result);
    await saveReviewer(result);
    setFallback(usedFallback);

    setProgress({
      step: "building",
      percent: 85,
      message: `Building quiz bank (${result.quizBank.length} questions)…`,
    });
    await sleep(250);

    setProgress({ step: "done", percent: 100, message: "Reviewer ready!" });
    await sleep(400);
    if (token !== generationToken.current) return;
    setProgress(null);
    setGenerating(false);
  }

  const handleGenerate = () => {
    const docs = queue
      .filter((q) => q.status === "ready" && q.extracted)
      .map((q) => q.extracted!);
    runGeneration(docs);
  };

  const readyCount = queue.filter((q) => q.status === "ready").length;
  const hasReviewer = !!reviewer;

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8">
        {!hasReviewer ? (
          <>
            <section className="grid items-start gap-12 lg:grid-cols-[1.05fr_1fr]">
              <div className="animate-slide-up pt-4 sm:pt-8">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand dark:text-brand-light">
                  PDF / DOCX / TXT
                </p>
                <h2 className="mt-4 font-display text-4xl font-medium leading-[1.05] tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
                  Turn your study materials into a{" "}
                  <em className="font-display italic font-medium text-brand">
                    reviewer that sticks
                  </em>
                </h2>
                <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Drop your notes and get a summary, terms, flashcards, and a
                  quiz, all from your own files.
                </p>
              </div>

              <div className="animate-slide-up space-y-4" style={{ animationDelay: "80ms" }}>
                {notice && (
                  <div
                    role="status"
                    className="animate-fade-in rounded-lg border border-brand/25 bg-brand/5 px-3 py-2.5 text-xs font-medium text-brand dark:border-brand/40 dark:bg-brand/10 dark:text-brand-light"
                  >
                    {notice}
                  </div>
                )}

                <Dropzone onFiles={handleFiles} disabled={generating} />

                {queue.length > 0 && (
                  <FileQueue items={queue} onRemove={handleRemove} disabled={generating} />
                )}

                {readyCount > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
                    <div className="min-w-0 px-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>
                        {readyCount} file{readyCount === 1 ? "" : "s"} ready
                      </span>
                      <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
                      <span>
                        {formatBytes(queue.reduce((s, q) => s + q.sizeBytes, 0))} total
                      </span>
                    </div>
                    <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
                      <button
                        onClick={handleNewSession}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-2.5 text-xs text-zinc-400 transition hover:text-red-500"
                      >
                        <Trash2 size={12} /> Clear all
                      </button>
                      {generating ? (
                        <span className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white sm:flex-none">
                          <Loader2 size={14} className="animate-spin" />
                          Generating…
                        </span>
                      ) : (
                        <button
                          onClick={handleGenerate}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-dark active:scale-[0.98] sm:flex-none"
                        >
                          <Wand2 size={14} />
                          {hasReviewer ? "Update Reviewer" : "Generate Study Reviewer"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="mt-20 border-t border-zinc-200 pt-12 dark:border-zinc-800">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                What you get
              </h2>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                One study pack, built entirely from your own files.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {FEATURES.map((f, i) => {
                  const Icon = f.icon;
                  const tinted = i === 0 || i === 3 || i === 5;
                  return (
                    <div
                      key={f.title}
                      className={`group relative flex items-start gap-4 rounded-xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-18px_rgba(15,118,110,0.4)] ${
                        tinted
                          ? "border-brand/15 bg-brand/[0.04] hover:border-brand/40 hover:bg-brand/[0.07] dark:bg-brand/[0.07] dark:hover:border-brand/50"
                          : "border-zinc-200 bg-white hover:border-brand/40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-brand/50"
                      }`}
                    >
                      <ChevronRight className="absolute right-4 top-5 h-4 w-4 -translate-x-1 text-brand opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand transition-all duration-300 group-hover:scale-110 group-hover:bg-brand/15">
                        <Icon size={18} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {f.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {f.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <footer className="mt-12 border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <p className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
                <ShieldCheck size={14} className="shrink-0" />
                Files are processed in your browser and stored only on this
                device. Nothing is uploaded to a server and no account is
                needed.
              </p>
            </footer>
          </>
        ) : (
          <section className="space-y-6">
            <div className="relative overflow-hidden rounded-xl border border-brand/25 bg-gradient-to-br from-brand/[0.07] to-transparent p-4 dark:border-brand/40">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Sparkles size={18} />
                  </span>
                  <div>
                    <p className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      Study reviewer ready
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {readyCount} document{readyCount === 1 ? "" : "s"} in queue ·{" "}
                      {reviewer.quizBank.length} quiz questions · updated{" "}
                      {new Date(reviewer.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleNewSession}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-red-400 hover:text-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <Trash2 size={13} /> New session
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || readyCount === 0}
                    className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                  >
                    {generating ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCcw size={14} />
                    )}
                    {generating ? "Updating…" : "Update Reviewer"}
                  </button>
                </div>
              </div>
            </div>

            {fallback && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                <FileWarning size={16} className="shrink-0" />
                Some content may not be fully accurate.
              </div>
            )}

            {generating && progress && <ProgressSteps progress={progress} />}

            {queue.length > 0 && (
              <details className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  Manage documents ({queue.length})
                </summary>
                <div className="mt-3">
                  {notice && (
                    <div
                      role="status"
                      className="animate-fade-in mb-3 rounded-lg border border-brand/25 bg-brand/5 px-3 py-2.5 text-xs font-medium text-brand dark:border-brand/40 dark:bg-brand/10 dark:text-brand-light"
                    >
                      {notice}
                    </div>
                  )}
                  <FileQueue items={queue} onRemove={handleRemove} disabled={generating} />
                  <div className="mt-3">
                    <Dropzone onFiles={handleFiles} disabled={generating} />
                  </div>
                </div>
              </details>
            )}

            {reviewer && (
              <Dashboard
                reviewer={reviewer}
                questionTarget={questionTarget}
                onTargetChange={setQuestionTarget}
              />
            )}
          </section>
        )}
      </main>

      {reviewer && <PrintPanel reviewer={reviewer} />}
    </div>
  );
}
