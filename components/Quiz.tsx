"use client";

import { useMemo, useState } from "react";
import {
  Check,
  X,
  Trophy,
  RotateCcw,
  ChevronRight,
  CircleDot,
  Sparkles,
  Loader2,
} from "lucide-react";
import type { QuizQuestion } from "@/lib/types";

interface Props {
  bank: QuizQuestion[];
  questionTarget: number;
  onTargetChange: (n: number) => void;
  context?: string;
}

const TARGET_OPTIONS = [10, 20, 30, 50, 70, 100];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Status = "setup" | "running" | "finished";

export default function Quiz({ bank, questionTarget, onTargetChange, context }: Props) {
  const [status, setStatus] = useState<Status>("setup");
  const [target, setTarget] = useState(questionTarget);
  const [session, setSession] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [aiExplanations, setAiExplanations] = useState<Record<number, string>>({});
  const [aiExplaining, setAiExplaining] = useState<Record<number, boolean>>({});

  const handleExplain = async (q: QuizQuestion, selectedIndex: number) => {
    setAiExplaining((prev) => ({ ...prev, [q.id]: true }));
    setAiExplanations((prev) => ({ ...prev, [q.id]: "" }));
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.question,
          options: q.options,
          selected: selectedIndex === -1 ? "Skipped" : q.options[selectedIndex],
          correct: q.options[q.correctAnswerIndex],
          context: context,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to fetch explanation");
      }
      
      const data = await res.json();
      if (data.explanation) {
        setAiExplanations((prev) => ({
          ...prev,
          [q.id]: data.explanation,
        }));
      }
    } catch (e) {
      setAiExplanations((prev) => ({
        ...prev,
        [q.id]: `Error: ${e instanceof Error ? e.message : String(e)}`,
      }));
    } finally {
      setAiExplaining((prev) => ({ ...prev, [q.id]: false }));
    }
  };

  const start = () => {
    // Explicitly use activeTarget to guarantee the generated session matches what the user saw highlighted
    setSession(shuffle(bank).slice(0, Math.min(activeTarget, bank.length)));
    setAnswers({});
    setIndex(0);
    setChecked(new Set());
    setStatus("running");
  };

  const finish = () => {
    setStatus("finished");
  };

  const current = session[index];
  const revealed = current ? checked.has(current.id) : false;

  const answer = (qid: number, choice: number) => {
    if (revealed) return;
    setAnswers((a) => ({ ...a, [qid]: choice }));
  };

  const total = session.length;
  const answered = Object.keys(answers).length;
  const correct = useMemo(
    () =>
      session.filter((q) => checked.has(q.id) && answers[q.id] === q.correctAnswerIndex).length,
    [session, answers, checked]
  );
  const score = correct;

  const chooseTarget = (n: number) => {
    setTarget(n);
    onTargetChange(n);
  };

  const maxAvailable = Math.min(100, bank.length);
  const availableTargets = (() => {
    const base = TARGET_OPTIONS.filter((n) => n <= maxAvailable);
    if (maxAvailable > 0 && !base.includes(maxAvailable)) {
      base.push(maxAvailable);
    }
    return base.length > 0 ? base : maxAvailable > 0 ? [maxAvailable] : [];
  })();
  const activeTarget = Math.max(1, Math.min(target, maxAvailable));

  if (bank.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <CircleDot size={28} className="mx-auto mb-3 text-zinc-300" />
        <p className="text-sm text-zinc-500">
          No quiz questions were generated from the source material.
        </p>
      </div>
    );
  }

  if (status === "setup") {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <Trophy size={32} className="mx-auto mb-3 text-amber-500" />
        <h3 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Practice Quiz
        </h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {bank.length} questions available. Questions and answer choices are
          shuffled on every attempt.
        </p>

          <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Number of questions
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {availableTargets.map((n) => (
              <button
                key={n}
                onClick={() => chooseTarget(n)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                  activeTarget === n
                    ? "border-brand bg-brand text-white"
                    : "border-zinc-200 text-zinc-600 hover:border-brand dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Target: {activeTarget} · Available: {bank.length}
          </p>
        </div>

        <button
          onClick={start}
          className="mt-6 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40"
          disabled={bank.length === 0}
        >
          Start Quiz →
        </button>
      </div>
    );
  }

  if (status === "finished") {
    const pct = total ? Math.round((correct / total) * 100) : 0;
    const message =
      pct >= 90
        ? "Outstanding. You've mastered this material!"
        : pct >= 70
          ? "Great job. Solid understanding."
          : pct >= 50
            ? "Decent. Review the missed questions below."
            : "Keep studying. Review the topics and try again.";
    const missed = session.filter(
      (q) => answers[q.id] !== q.correctAnswerIndex
    );
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <Trophy size={36} className="mx-auto mb-3 text-amber-500" />
          <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            {correct} / {total}
          </p>
          <p className="mt-1 text-sm text-zinc-500">{pct}% correct</p>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{message}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={start}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <RotateCcw size={14} /> Retake (reshuffled)
            </button>
            <button
              onClick={() => setStatus("setup")}
              className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-600 transition hover:border-brand dark:border-zinc-700 dark:text-zinc-300"
            >
              Change settings
            </button>
          </div>
        </div>

        {missed.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Review missed questions
            </h4>
            {missed.map((q) => (
              <div
                key={q.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {q.question}
                </p>
                <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
                  ✓ {q.options[q.correctAnswerIndex]}
                </p>
                {q.explanation && (
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {q.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-16 z-10 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            Question {index + 1} of {total}
          </span>
          <span className="font-semibold text-brand">
            Score: {score} {revealed && answers[current.id] === current.correctAnswerIndex ? " ✓" : ""}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light transition-all duration-300"
            style={{ width: `${((index + (revealed ? 1 : 0)) / total) * 100}%` }}
          />
        </div>
      </div>

      {current && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-4 flex items-start justify-between gap-3">
            <p className="text-base font-semibold leading-relaxed text-zinc-900 dark:text-zinc-50">
              {current.question}
            </p>
            <span className="flex shrink-0 items-center gap-1.5">
              {current.type === "tf" && (
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand dark:bg-brand/20 dark:text-brand-light">
                  True/False
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  current.difficulty === "easy"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : current.difficulty === "medium"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                }`}
              >
                {current.difficulty}
              </span>
            </span>
          </div>

          <div className="space-y-2">
            {current.options.map((opt, oi) => {
              const chosen = answers[current.id] === oi;
              const isCorrect = oi === current.correctAnswerIndex;
              let cls =
                "border-zinc-200 bg-white hover:border-brand hover:bg-brand/5 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-brand";
              if (revealed && isCorrect)
                cls =
                  "border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-900/30";
              else if (revealed && chosen && !isCorrect)
                cls =
                  "border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-900/30";
              else if (!revealed && chosen)
                cls = "border-brand bg-brand/10";

              return (
                <button
                  key={oi}
                  data-option={oi}
                  onClick={() => answer(current.id, oi)}
                  disabled={revealed}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${cls} ${revealed ? "cursor-default" : "cursor-pointer"}`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-[10px] font-semibold text-zinc-500 dark:border-zinc-600">
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <span className="flex-1 text-zinc-800 dark:text-zinc-200">
                    {opt}
                  </span>
                  {revealed && isCorrect && (
                    <Check size={16} className="shrink-0 text-emerald-500" />
                  )}
                  {revealed && chosen && !isCorrect && (
                    <X size={16} className="shrink-0 text-red-500" />
                  )}
                </button>
              );
            })}
          </div>

          {revealed && (
            <div className="mt-4 animate-fade-in rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-800/60">
              {answers[current.id] === current.correctAnswerIndex ? (
                <p className="font-medium text-emerald-600 dark:text-emerald-400">
                  Correct!
                </p>
              ) : (
                <p className="font-medium text-red-600 dark:text-red-400">
                  Not quite. The correct answer is{" "}
                  <span className="font-semibold">
                    {String.fromCharCode(65 + current.correctAnswerIndex)}.{" "}
                    {current.options[current.correctAnswerIndex]}
                  </span>
                </p>
              )}
              {current.explanation && (
                <p className="mt-1.5 leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {current.explanation.replace(/\s*[—–]\s*/g, ": ")}
                </p>
              )}
              {current.sourceDoc && (
                <p className="mt-1 text-xs text-zinc-400">
                  Source: {current.sourceDoc}
                </p>
              )}
              
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700/60">
                {!aiExplanations[current.id] && !aiExplaining[current.id] ? (
                  <button
                    onClick={() => handleExplain(current, answers[current.id])}
                    className="flex items-center gap-1.5 text-xs font-semibold text-brand transition hover:text-brand-dark"
                  >
                    <Sparkles size={14} /> Ask AI Tutor to explain why
                  </button>
                ) : (
                  <div className="space-y-2 rounded-lg bg-white p-4 shadow-sm border border-brand/20 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-2 text-xs font-bold text-brand uppercase tracking-wider mb-2">
                      <Sparkles size={14} /> AI Tutor
                    </div>
                    {aiExplanations[current.id]?.split("\n\n").map((para, i) => (
                      <p key={i} className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {para.replace(/\*\*(.*?)\*\*/g, "$1")}
                      </p>
                    ))}
                    {aiExplaining[current.id] && (
                      <div className="flex items-center gap-2 text-xs text-brand">
                        <Loader2 size={12} className="animate-spin" /> Thinking...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={() => {
                if (index > 0) {
                  setIndex(index - 1);
                }
              }}
              disabled={index === 0}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition enabled:hover:border-brand disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
            >
              ← Back
            </button>
            {revealed ? (
              <button
                onClick={() => {
                  if (index < total - 1) {
                    setIndex(index + 1);
                  } else {
                    finish();
                  }
                }}
                className="flex items-center gap-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                {index < total - 1 ? "Next question" : "Finish"} <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={() => {
                  if (answers[current.id] === undefined) {
                    setAnswers((a) => ({
                      ...a,
                      [current.id]: -1,
                    }));
                  }
                  setChecked((c) => new Set(c).add(current.id));
                }}
                disabled={answered >= total}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:border-brand disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
              >
                {answers[current.id] === undefined
                  ? "Skip / reveal"
                  : "Check answer"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
