"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User } from "lucide-react";
import type { ReviewerData } from "@/lib/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function TutorChat({ reviewer }: { reviewer: ReviewerData }) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(`tutor_chat_${reviewer.id}`);
      if (saved) return JSON.parse(saved);
    }
    return [{ role: "assistant", content: "Hi! I'm your AI tutor. I've read your study guide. What would you like me to explain or clarify?" }];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    sessionStorage.setItem(`tutor_chat_${reviewer.id}`, JSON.stringify(messages));
  }, [messages, reviewer.id]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    // Build concise context string from reviewer to save tokens
    const context = `
Title: ${reviewer.summary.title}
Overview: ${reviewer.summary.overview}
Key Takeaways: ${reviewer.summary.keyTakeaways.join("; ")}
Terms: ${reviewer.terms.map(t => `${t.term}: ${t.definition}`).join(" | ")}
    `.trim().substring(0, 8000); // hard cap context to avoid massive token usage

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          context,
          history: messages.slice(1).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || "Sorry, I couldn't generate a reply." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Oops, something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] max-h-[70vh] rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.role === "user" ? "bg-brand/10 text-brand" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
              {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm ${msg.role === "user" ? "bg-brand text-white" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-200"}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              <Bot size={16} />
            </div>
            <div className="rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800/80">
              <Loader2 size={14} className="animate-spin text-zinc-500" />
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
        <form 
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to explain a concept..."
            className="flex-1 rounded-xl border border-zinc-200 bg-transparent px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-zinc-800 dark:focus:border-brand-light"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            <Send size={16} className="ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
}
