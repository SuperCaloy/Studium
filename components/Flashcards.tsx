"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RefreshCcw, Check, X, RotateCw } from "lucide-react";
import type { TermDefinition } from "@/lib/types";

export default function Flashcards({ terms }: { terms: TermDefinition[] }) {
  const [queue, setQueue] = useState<TermDefinition[]>(terms);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);

  if (terms.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No terms available for flashcard study.
      </p>
    );
  }

  if (queue.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-16 space-y-4"
      >
        <div className="rounded-full bg-brand/10 p-4 text-brand">
          <Check size={32} />
        </div>
        <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          You mastered all terms!
        </h3>
        <p className="text-sm text-zinc-500">
          You have successfully reviewed all {terms.length} concepts.
        </p>
        <button
          onClick={() => {
            setQueue(terms);
            setCurrentIndex(0);
            setFlipped(false);
          }}
          className="mt-4 flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          <RefreshCcw size={14} /> Study Again
        </button>
      </motion.div>
    );
  }

  const term = queue[currentIndex];

  const handleNext = (mastered: boolean) => {
    setExitDir(mastered ? "right" : "left");
    setFlipped(false);
    
    setTimeout(() => {
      let nextQueue = [...queue];
      if (mastered) {
        // Remove from queue if mastered
        nextQueue = nextQueue.filter((_, i) => i !== currentIndex);
      } else {
        // Leave in queue, rotate it to the back if there are other items
        if (nextQueue.length > 1) {
          const missed = nextQueue.splice(currentIndex, 1)[0];
          nextQueue.push(missed);
        }
      }
      
      setQueue(nextQueue);
      if (nextQueue.length > 0) {
        setCurrentIndex(mastered ? currentIndex % nextQueue.length : 0);
      }
      setExitDir(null);
    }, 200);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 overflow-hidden">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span className="font-medium text-zinc-600 dark:text-zinc-300">
          Card {terms.length - queue.length + 1} of {terms.length}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold dark:bg-zinc-800">
          {queue.length} left
        </span>
      </div>

      <div className="relative min-h-[240px] w-full perspective-[1200px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={term.id + (exitDir ?? "")}
            initial={
              exitDir === null
                ? { opacity: 0, y: 20 }
                : false
            }
            animate={{
              opacity: 1,
              y: 0,
              x: 0,
              rotateY: flipped ? 180 : 0,
            }}
            exit={{
              opacity: 0,
              x: exitDir === "left" ? -100 : exitDir === "right" ? 100 : 0,
              rotate: exitDir === "left" ? -5 : exitDir === "right" ? 5 : 0,
            }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="absolute inset-0 w-full h-full cursor-pointer preserve-3d"
            onClick={() => setFlipped(!flipped)}
          >
            {/* Front (Term) */}
            <div
              className="absolute inset-0 flex items-center justify-center rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm backface-hidden dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="text-center font-display text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {term.term}
              </p>
            </div>

            {/* Back (Definition) */}
            <div
              className="absolute inset-0 flex items-center justify-center rounded-2xl border border-brand/40 bg-brand/5 p-8 backface-hidden"
              style={{ transform: "rotateY(180deg)" }}
            >
              <div className="max-h-full overflow-y-auto w-full text-center scrollbar-hide">
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {term.definition}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {flipped ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3"
        >
          <button
            onClick={() => handleNext(false)}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 active:scale-[0.98] dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
          >
            <X size={16} /> Needs Review
          </button>
          <button
            onClick={() => handleNext(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-100 active:scale-[0.98] dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
          >
            <Check size={16} /> Got It
          </button>
        </motion.div>
      ) : (
        <div className="flex justify-center h-[48px] items-center">
          <p className="text-xs text-zinc-400 flex items-center gap-1.5">
            <RotateCw size={12} /> Click the card to reveal
          </p>
        </div>
      )}

      <div className="flex justify-center pt-4">
        <button
          onClick={() => {
            setQueue(terms);
            setCurrentIndex(0);
            setFlipped(false);
          }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <RefreshCcw size={12} /> Restart Deck
        </button>
      </div>
    </div>
  );
}
