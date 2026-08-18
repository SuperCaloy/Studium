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
import ConfirmModal from "@/components/ConfirmModal";
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
  { icon: FileText, title: "Accelerated Learning", text: "Grasp core concepts in seconds, rather than hours.", span: "sm:col-span-2 lg:col-span-2" },
  { icon: FolderOpen, title: "Intelligent Organization", text: "Turn messy lecture notes into structured, subject-based outlines.", span: "sm:col-span-1 lg:col-span-1" },
  { icon: BookMarked, title: "Auto-Generated Glossary", text: "Instantly extract and define every key term.", span: "sm:col-span-1 lg:col-span-1" },
  { icon: Layers, title: "Active Recall Engine", text: "Reinforce memory with auto-generated digital flashcards.", span: "sm:col-span-2 lg:col-span-1" },
  { icon: ListChecks, title: "Adaptive Quizzing", text: "Identify knowledge gaps with dynamic, custom-generated practice tests.", span: "sm:col-span-1 lg:col-span-1" },
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
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  } | null>(null);
  const generationToken = useRef(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
      setQueue((currentQueue) => {
        const newItems: QueueItem[] = [];
        const filesToProcess: { file: File; item: QueueItem }[] = [];
        
        let limitHit = false;
        let sizeHit = false;
        let dupeHit = false;

        for (const file of files) {
          if (file.size > 10 * 1024 * 1024) {
            sizeHit = true;
            continue;
          }

          const duplicate = currentQueue.some(
            (q) => q.name.toLowerCase() === file.name.toLowerCase() && q.sizeBytes === file.size
          ) || newItems.some(
            (q) => q.name.toLowerCase() === file.name.toLowerCase() && q.sizeBytes === file.size
          );
          
          if (duplicate) {
            dupeHit = true;
            continue;
          }

          if (currentQueue.length + newItems.length >= 5) {
            limitHit = true;
            continue;
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

          newItems.push(item);
          filesToProcess.push({ file, item });
        }

        setTimeout(() => {
          if (limitHit) {
            showNotice("Maximum 5 files allowed. Extra files were ignored.");
          } else if (sizeHit) {
            showNotice("Files exceeding the 10MB limit were ignored.");
          } else if (dupeHit) {
            showNotice("Duplicate files were ignored.");
          }
        }, 0);

        if (newItems.length > 0) {
          filesToProcess.forEach(({ file, item }) => {
            extractText(file)
              .then(doc => {
                setQueue((q) =>
                  q.map((x) => (x.id === item.id ? { ...x, status: "ready", extracted: doc } : x))
                );
              })
              .catch(err => {
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
              });
          });
          return [...currentQueue, ...newItems];
        }

        return currentQueue;
      });
    },
    []
  );

  const handleRemove = async (id: string) => {
    setQueue((q) => {
      const item = q.find((x) => x.id === id);
      if (item?.extracted) {
        removeDocument(item.extracted.id).catch(console.error);
      }
      return q.filter((x) => x.id !== id);
    });
  };

  const promptNewSession = () => {
    setConfirmModal({
      isOpen: true,
      title: "Start New Session?",
      message: "Are you sure you want to clear everything? All your uploaded documents and the generated study guide will be permanently deleted.",
      confirmText: "Yes, clear all",
      onConfirm: async () => {
        generationToken.current++;
        await clearAll();
        setReviewer(null);
        setQueue([]);
        setFallback(false);
        setProgress(null);
        setGenerating(false);
      }
    });
  };

  const promptCancelGeneration = () => {
    setConfirmModal({
      isOpen: true,
      title: "Cancel Generation?",
      message: "Are you sure you want to stop generating? Your current progress will be lost.",
      confirmText: "Yes, cancel",
      onConfirm: () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        generationToken.current++;
        setGenerating(false);
        setProgress(null);
      }
    });
  };

  async function runGeneration(docs: ExtractedDocument[]) {
    if (docs.length === 0) return;
    generationToken.current++;
    const token = generationToken.current;
    
    abortControllerRef.current = new AbortController();
    
    setGenerating(true);
    setFallback(false);
    setProgress({
      step: "parsing",
      percent: 12,
      message: "Reading your study materials…",
    });
    await sleep(200);

    setProgress({
      step: "compiling",
      percent: 30,
      message: `Organizing notes from ${docs.length} document${docs.length === 1 ? "" : "s"}…`,
    });
    await sleep(300);

    setProgress({
      step: "extracting",
      percent: 55,
      message: "Finding the most important topics and terms…",
    });

    let usedFallback = false;
    let currentReviewer: ReviewerData | null = null;
    
    try {
      const res = await fetch("/api/generate?stream=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docs: serializeDocs(docs),
        }),
        signal: abortControllerRef.current.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `Server responded with ${res.status}.`);
      }
      
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No streaming support.");
      
      const decoder = new TextDecoder();
      let buffer = "";

      // Show dashboard instantly with skeletons
      currentReviewer = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        summary: { title: "Generating Reviewer...", overview: "", keyTakeaways: [], docCount: docs.length, totalPages: 0, totalWords: 0, targetStudyMinutes: 0 },
        topics: [],
        terms: [],
        facts: [],
        quizBank: [],
        engine: "ai",
      };
      setReviewer(currentReviewer);
      setProgress(null); // Instantly jump to dashboard to watch streaming

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (token !== generationToken.current) return;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          const eventMatch = block.match(/event: (.*)\n/);
          const dataMatch = block.match(/data: (.*)/);
          if (eventMatch && dataMatch) {
            const event = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);

            if (event === "topics" && currentReviewer) {
              const topicsWithIds = data.topics.map((t: any) => ({ ...t, id: t.id || crypto.randomUUID() }));
              currentReviewer = { ...currentReviewer, topics: topicsWithIds };
              setReviewer(currentReviewer);
            } else if (event === "terms" && currentReviewer) {
              const termsWithIds = data.terms.map((t: any) => ({ ...t, id: t.id || crypto.randomUUID() }));
              currentReviewer = { ...currentReviewer, terms: termsWithIds };
              setReviewer(currentReviewer);
            } else if (event === "quiz" && currentReviewer) {
              currentReviewer = { ...currentReviewer, quizBank: data };
              setReviewer(currentReviewer);
            } else if (event === "done") {
              currentReviewer = data;
              setReviewer(currentReviewer);
            } else if (event === "error") {
              throw new Error(data.message);
            }
          }
        }
      }
      usedFallback = !!currentReviewer?.engine && currentReviewer.engine === "offline";
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (token !== generationToken.current) return;
      console.error("Generation failed:", err);
      // Let existing fallback mechanism handle UI state
      usedFallback = true;
    }

    if (!currentReviewer) return;
    if (token !== generationToken.current) return;
    
    await saveReviewer(currentReviewer);
    setFallback(usedFallback);
    
    setGenerating(false);
  }

  const handleGenerate = () => {
    const docs = queue
      .filter((q) => q.status === "ready" && q.extracted)
      .map((q) => q.extracted!);
    runGeneration(docs);
  };

  const isParsing = queue.some((q) => q.status === "parsing");
  const readyCount = queue.filter((q) => q.status === "ready").length;
  const hasReviewer = !!reviewer;

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8">
        {!hasReviewer ? (
          <>
            <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
              <div className="animate-slide-up pt-4 sm:pt-8">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand dark:text-brand-light">
                  PDF / DOCX / TXT
                </p>
                <h2 className="mt-4 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl lg:text-6xl">
                  Upload your notes.{" "}
                  <span className="text-brand dark:text-brand-light">
                    Ace your exams.
                  </span>
                </h2>
                <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Transform course materials into an interactive study guide in seconds. Instantly generate AI-powered flashcards, practice quizzes, and comprehensive summaries built exclusively from your notes.
                </p>
                <div className="mt-8 flex items-start gap-3.5 rounded-2xl border border-zinc-200/60 bg-zinc-50/50 p-4 text-sm leading-relaxed text-zinc-600 dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:text-zinc-400 sm:max-w-[52ch]">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Privacy note:</strong>{" "}
                    Please do not upload files containing private or sensitive information (like passwords or personal records) to keep your data safe.
                  </div>
                </div>
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
                        onClick={promptNewSession}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-2.5 text-xs text-zinc-400 transition hover:text-red-500"
                      >
                        <Trash2 size={12} /> Clear all
                      </button>
                      {generating ? (
                        <div className="flex flex-1 items-center gap-2 sm:flex-none">
                          <span className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white opacity-80 cursor-not-allowed sm:flex-none">
                            <Loader2 size={14} className="animate-spin" />
                            Generating…
                          </span>
                          <button
                            onClick={promptCancelGeneration}
                            className="rounded-lg border border-red-200 bg-white px-3 py-2.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleGenerate}
                          disabled={readyCount === 0 || isParsing}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-dark active:scale-[0.98] sm:flex-none disabled:opacity-50"
                        >
                          <Wand2 size={14} />
                          {isParsing ? "Parsing Files..." : hasReviewer ? "Update Reviewer" : "Generate Study Reviewer"}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {generating && progress && (
                  <div className="pt-2">
                    <ProgressSteps progress={progress} />
                  </div>
                )}
              </div>
            </section>

            <section className="mt-20 border-t border-zinc-200 pt-12 dark:border-zinc-800">
              <h2 className="text-balance text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                What you get
              </h2>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                One study pack, built entirely from your own files.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map((f, i) => {
                  const Icon = f.icon;
                  const isTinted = i === 0 || i === 3;
                  return (
                    <div
                      key={f.title}
                      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 transition-[transform,border-color,box-shadow,background-color] duration-300 hover:-translate-y-1 hover:shadow-lg ${f.span} ${
                        isTinted
                          ? "border-brand/20 bg-brand/5 hover:border-brand/40 dark:border-brand/20 dark:bg-brand/10 dark:hover:border-brand/40"
                          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700"
                      }`}
                    >
                      <div className="relative z-10">
                        <span className={`mb-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${isTinted ? 'bg-brand/10 text-brand dark:bg-brand/20 dark:text-brand-light' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 group-hover:bg-brand/10 group-hover:text-brand dark:group-hover:bg-brand/20 dark:group-hover:text-brand-light'}`}>
                          <Icon size={18} />
                        </span>
                        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                          {f.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {f.text}
                        </p>
                      </div>
                      {isTinted && (
                        <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-brand/10 blur-2xl transition-colors duration-500 group-hover:bg-brand/20" />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>


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
                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
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
                    onClick={promptNewSession}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-red-400 hover:text-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    <Trash2 size={13} /> New session
                  </button>
                  {generating ? (
                    <button
                      onClick={promptCancelGeneration}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerate}
                      disabled={readyCount === 0 || isParsing}
                      className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
                    >
                      <RefreshCcw size={14} />
                      {isParsing ? "Parsing Files..." : "Update Reviewer"}
                    </button>
                  )}
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

      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        />
      )}
    </div>
  );
}
