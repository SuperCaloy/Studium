"use client";

import { useState, useRef, useEffect } from "react";
import { LayoutDashboard, FolderOpen, BookMarked, Layers, ListChecks, FlaskConical, Network, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReviewerData } from "@/lib/types";
import SummaryPanel from "./SummaryPanel";
import TopicsPanel from "./TopicsPanel";
import TermsTable from "./TermsTable";
import Flashcards from "./Flashcards";
import Quiz from "./Quiz";
import FactsPanel from "./FactsPanel";
import ConceptMap from "./ConceptMap";
import ExportBar from "./ExportBar";
import TutorChat from "./TutorChat";
import { MessageCircleQuestion } from "lucide-react";

type Tab = "summary" | "map" | "topics" | "terms" | "facts" | "flashcards" | "quiz" | "tutor";

interface Props {
  reviewer: ReviewerData;
  questionTarget: number;
  onTargetChange: (n: number) => void;
}

const TABS: { key: Tab; label: string; icon: typeof LayoutDashboard; badge?: (r: ReviewerData) => number; show?: (r: ReviewerData) => boolean }[] = [
  { key: "summary", label: "Summary", icon: LayoutDashboard },
  { key: "map", label: "Concept Map", icon: Network, show: (r) => r.engine === "ai" },
  { key: "topics", label: "Topics", icon: FolderOpen, badge: (r) => r.topics.length },
  { key: "terms", label: "Terms", icon: BookMarked, badge: (r) => r.terms.length },
  { key: "facts", label: "Key Facts", icon: FlaskConical, badge: (r) => (r.facts ?? []).length, show: (r) => !!(r.facts && r.facts.length > 0) },
  { key: "flashcards", label: "Flashcards", icon: Layers, badge: (r) => r.terms.length },
  { key: "quiz", label: "Quiz", icon: ListChecks, badge: (r) => r.quizBank.length },
  { key: "tutor", label: "Tutor Chat", icon: MessageCircleQuestion },
];

export default function Dashboard({ reviewer, questionTarget, onTargetChange }: Props) {
  const [tab, setTab] = useState<Tab>("summary");

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const visibleTabs = TABS.filter((t) => (t.show ? t.show(reviewer) : true));

  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === tab)) {
      setTab("summary");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, reviewer]);

  const resetIdle = () => {
    setIsIdle(false);
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(() => setIsIdle(true), 2500);
  };

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      
      // If content fully fits (with a 5px tolerance for sub-pixel rendering), disable both
      if (scrollWidth <= clientWidth + 5) {
        setCanScrollLeft(false);
        setCanScrollRight(false);
        return;
      }
      
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft) < scrollWidth - clientWidth - 2);
    }
  };

  // Check scroll state on mount, resize, and layout changes
  useEffect(() => {
    checkScroll();
    resetIdle();
    
    let observer: ResizeObserver;
    if (scrollRef.current) {
      observer = new ResizeObserver(() => {
        checkScroll();
      });
      observer.observe(scrollRef.current);
    }
    
    window.addEventListener("resize", checkScroll);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", checkScroll);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [reviewer]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 250;
      scrollRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-6">
      <ExportBar reviewer={reviewer} />

      <div 
        className="relative group"
        onMouseEnter={resetIdle}
        onTouchStart={resetIdle}
      >
        {/* Left Edge Fade & Scroll Button */}
        <div className={`absolute left-0 top-0 bottom-2 w-24 bg-gradient-to-r from-zinc-50 dark:from-zinc-950 to-transparent z-10 transition-opacity duration-300 flex items-center justify-start ${canScrollLeft && !isIdle ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
          <button 
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm shadow-sm border border-zinc-200/50 dark:border-zinc-800/50 text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 hover:text-brand transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${canScrollLeft ? "cursor-pointer pointer-events-auto" : "pointer-events-none"}`}
            aria-label="Scroll left"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Scrollable Container */}
        <div 
          ref={scrollRef}
          onScroll={() => {
            checkScroll();
            resetIdle();
          }}
          className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 px-1 scroll-smooth"
        >
          {TABS.filter(t => t.show ? t.show(reviewer) : true).map((t) => {
            const Icon = t.icon;
            const badge = t.badge ? t.badge(reviewer) : 0;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={(e) => {
                  setTab(t.key);
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 min-h-[44px] text-sm font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${
                  active
                    ? "bg-brand text-white shadow-sm"
                    : "bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {t.label}
                {badge > 0 && (
                  <span
                    className={`flex h-5 items-center justify-center rounded-full px-2 text-[10px] font-semibold tabular-nums ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Edge Fade & Scroll Button */}
        <div className={`absolute right-0 top-0 bottom-2 w-24 bg-gradient-to-l from-zinc-50 dark:from-zinc-950 to-transparent z-10 transition-opacity duration-300 flex items-center justify-end ${canScrollRight && !isIdle ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
          <button 
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm shadow-sm border border-zinc-200/50 dark:border-zinc-800/50 text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 hover:text-brand transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${canScrollRight ? "cursor-pointer pointer-events-auto" : "pointer-events-none"}`}
            aria-label="Scroll right"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="animate-fade-in">
        {tab === "summary" && <SummaryPanel reviewer={reviewer} />}
        {tab === "map" && <ConceptMap reviewer={reviewer} />}
        {tab === "topics" && <TopicsPanel topics={reviewer.topics} />}
        {tab === "terms" && <TermsTable terms={reviewer.terms} />}
        {tab === "facts" && <FactsPanel facts={reviewer.facts ?? []} />}
        {tab === "flashcards" && <Flashcards terms={reviewer.terms} reviewerId={reviewer.id} />}
        {tab === "quiz" && (
          <Quiz
            bank={reviewer.quizBank}
            questionTarget={questionTarget}
            onTargetChange={onTargetChange}
            context={`${reviewer.summary.title}\n${reviewer.summary.overview}\n${reviewer.summary.keyTakeaways.join('\n')}`}
          />
        )}
        {tab === "tutor" && <TutorChat reviewer={reviewer} />}
      </div>
    </div>
  );
}
