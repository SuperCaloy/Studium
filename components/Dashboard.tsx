"use client";

import { useState } from "react";
import { LayoutDashboard, FolderOpen, BookMarked, Layers, ListChecks, FlaskConical, Network } from "lucide-react";
import type { ReviewerData } from "@/lib/types";
import SummaryPanel from "./SummaryPanel";
import TopicsPanel from "./TopicsPanel";
import TermsTable from "./TermsTable";
import Flashcards from "./Flashcards";
import Quiz from "./Quiz";
import FactsPanel from "./FactsPanel";
import ConceptMap from "./ConceptMap";
import ExportBar from "./ExportBar";

type Tab = "summary" | "map" | "topics" | "terms" | "facts" | "flashcards" | "quiz";

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
];

export default function Dashboard({ reviewer, questionTarget, onTargetChange }: Props) {
  const [tab, setTab] = useState<Tab>("summary");

  return (
    <div className="space-y-6">
      <ExportBar reviewer={reviewer} />

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.filter(t => t.show ? t.show(reviewer) : true).map((t) => {
          const Icon = t.icon;
          const badge = t.badge ? t.badge(reviewer) : 0;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition active:scale-[0.98] ${
                active
                  ? "bg-brand text-white shadow-sm"
                  : "text-zinc-600 hover:bg-brand/10 hover:text-brand dark:text-zinc-300 dark:hover:bg-brand/10 dark:hover:text-brand-light"
              }`}
            >
              <Icon size={15} />
              {t.label}
              {badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="animate-fade-in">
        {tab === "summary" && <SummaryPanel reviewer={reviewer} />}
        {tab === "map" && <ConceptMap reviewer={reviewer} />}
        {tab === "topics" && <TopicsPanel topics={reviewer.topics} />}
        {tab === "terms" && <TermsTable terms={reviewer.terms} />}
        {tab === "facts" && <FactsPanel facts={reviewer.facts ?? []} />}
        {tab === "flashcards" && <Flashcards terms={reviewer.terms} />}
        {tab === "quiz" && (
          <Quiz
            bank={reviewer.quizBank}
            questionTarget={questionTarget}
            onTargetChange={onTargetChange}
          />
        )}
      </div>
    </div>
  );
}
