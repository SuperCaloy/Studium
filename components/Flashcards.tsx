"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RefreshCcw, Check, X, RotateCw } from "lucide-react";
import type { TermDefinition } from "@/lib/types";

// Box 0: New/Learning
// Box 1: Reviewed once
// Box 2: Mastered
const MAX_BOX = 2;

export default function Flashcards({ terms, reviewerId }: { terms: TermDefinition[], reviewerId?: string }) {
  const [boxes, setBoxes] = useState<Record<string, number>>({});
  const [queue, setQueue] = useState<TermDefinition[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (reviewerId) {
      const saved = localStorage.getItem(`srs-${reviewerId}`);
      if (saved) {
        try {
          const parsedBoxes = JSON.parse(saved);
          setBoxes(parsedBoxes);
          buildQueue(parsedBoxes);
        } catch {
          buildQueue({});
        }
      } else {
        buildQueue({});
      }
    } else {
      buildQueue({});
    }
    setInitialized(true);
  }, [terms, reviewerId]);

  const buildQueue = (currentBoxes: Record<string, number>) => {
    // Only study terms that are not yet mastered (Box < MAX_BOX)
    const pending = terms.filter(t => (currentBoxes[t.id] ?? 0) < MAX_BOX);
    
    // Sort so lowest box (weakest terms) appear first
    pending.sort((a, b) => (currentBoxes[a.id] ?? 0) - (currentBoxes[b.id] ?? 0));
    
    setQueue(pending);
    setCurrentIndex(0);
  };

  const saveBoxes = (newBoxes: Record<string, number>) => {
    setBoxes(newBoxes);
    if (reviewerId) {
      localStorage.setItem(`srs-${reviewerId}`, JSON.stringify(newBoxes));
    }
  };

  if (!initialized) return null;

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
          You have successfully moved all {terms.length} concepts to the "Mastered" box.
        </p>
        <button
          onClick={() => {
            saveBoxes({}); // reset
            buildQueue({});
            setFlipped(false);
          }}
          className="mt-4 flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          <RefreshCcw size={14} /> Restart Deck
        </button>
      </motion.div>
    );
  }

  const term = queue[currentIndex];
  const currentBox = boxes[term.id] ?? 0;

  const handleNext = (gotIt: boolean) => {
    setExitDir(gotIt ? "right" : "left");
    setFlipped(false);
    
    setTimeout(() => {
      // Update Leitner Box
      const newBox = gotIt ? Math.min(currentBox + 1, MAX_BOX) : 0;
      const nextBoxes = { ...boxes, [term.id]: newBox };
      saveBoxes(nextBoxes);

      let nextQueue = [...queue];
      if (newBox === MAX_BOX) {
        // Mastered! Remove from queue.
        nextQueue = nextQueue.filter((_, i) => i !== currentIndex);
      } else {
        // Leave in queue, rotate it to the back
        if (nextQueue.length > 1) {
          const missed = nextQueue.splice(currentIndex, 1)[0];
          nextQueue.push(missed);
        }
      }
      
      setQueue(nextQueue);
      if (nextQueue.length > 0) {
        setCurrentIndex(gotIt ? currentIndex % nextQueue.length : 0);
      }
      setExitDir(null);
    }, 200);
  };

  const masteredCount = terms.length - queue.length;

  return (
    <div className="mx-auto max-w-xl space-y-6 overflow-hidden">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <div className="flex gap-4 items-center">
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            Card {masteredCount + 1} of {terms.length}
          </span>
          <div className="flex gap-1">
            <span className={`w-2 h-2 rounded-full ${currentBox >= 0 ? "bg-amber-400" : "bg-zinc-200 dark:bg-zinc-800"}`} title="Box 0 (Learning)" />
            <span className={`w-2 h-2 rounded-full ${currentBox >= 1 ? "bg-brand" : "bg-zinc-200 dark:bg-zinc-800"}`} title="Box 1 (Familiar)" />
            <span className={`w-2 h-2 rounded-full ${currentBox >= 2 ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"}`} title="Box 2 (Mastered)" />
          </div>
        </div>
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
            <div
              className="absolute inset-0 flex items-center justify-center rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm backface-hidden dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="text-center font-display text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {term.term}
              </p>
            </div>

            <div
              className="absolute inset-0 flex items-center justify-center rounded-2xl border border-brand/40 bg-brand/5 p-6 sm:p-8 backface-hidden"
              style={{ transform: "rotateY(180deg)" }}
            >
              <div className="max-h-full overflow-y-auto w-full text-center hide-scrollbar">
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
            <X size={16} /> Needs Review (Reset)
          </button>
          <button
            onClick={() => handleNext(true)}
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-100 active:scale-[0.98] dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
          >
            <div className="flex items-center gap-2"><Check size={16} /> Got It</div>
            <span className="text-[10px] font-normal opacity-80">+1 Level</span>
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
            saveBoxes({}); // reset
            buildQueue({});
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
