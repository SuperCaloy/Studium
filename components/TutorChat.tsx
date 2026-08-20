"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Bot, User, Square, RotateCcw, Copy, Check } from "lucide-react";
import type { ReviewerData } from "@/lib/types";
import { buildTutorContext } from "@/lib/tutor-context";

interface Message {
  role: "user" | "assistant";
  content: string;
  failed?: boolean;
}

export default function TutorChat({ reviewer }: { reviewer: ReviewerData }) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(`tutor_chat_${reviewer.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // corrupt storage — fall through to the default greeting
        }
      }
    }
    return [{ role: "assistant", content: "Hi! I'm your AI tutor. I've read your study guide. What would you like me to explain or clarify?" }];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserMsg = useRef<string>("");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, streamText]);

  useEffect(() => {
    sessionStorage.setItem(`tutor_chat_${reviewer.id}`, JSON.stringify(messages));
  }, [messages, reviewer.id]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setLoading(false);
  }, []);

  const retryLast = useCallback(() => {
    if (lastUserMsg.current) {
      sendMessage(lastUserMsg.current);
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg = text.trim();
      if (!userMsg || loading) return;
      lastUserMsg.current = userMsg;

      // Drop any previous failed assistant bubble so retry doesn't stack them.
      setMessages((prev) => [...prev.filter((m) => m.role !== "assistant" || !m.failed), { role: "user", content: userMsg }]);
      setInput("");
      setLoading(true);
      setStreaming(true);
      setStreamText("");

      const context = buildTutorContext(reviewer);
      abortRef.current = new AbortController();
      let full = "";

      try {
        const res = await fetch("/api/tutor?stream=true", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMsg,
            context,
            history: messages
              .filter((m) => m.role === "user" || m.role === "assistant")
              .filter((m) => !m.failed)
              .slice(-12)
              .map((m) => ({ role: m.role, content: m.content })),
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No streaming support");

        const decoder = new TextDecoder();
        let buffer = "";
        let doneReceived = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const block of lines) {
            const eventMatch = block.match(/event: (.*)\n/);
            const dataMatch = block.match(/data: (.*)/);
            if (!eventMatch || !dataMatch) continue;
            const event = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);

            if (event === "delta") {
              full += data.text ?? "";
              setStreamText(full);
            } else if (event === "done") {
              doneReceived = true;
              full = data.reply ?? full;
              setMessages((prev) => [...prev, { role: "assistant", content: full }]);
              setStreamText("");
            } else if (event === "error") {
              throw new Error(data.message ?? "Tutor error");
            }
          }
        }

        // Stream ended without a terminal event (dropped connection, etc.).
        // Keep any partial text; otherwise surface the retry affordance.
        if (!doneReceived) {
          if (full) {
            setMessages((prev) => [...prev, { role: "assistant", content: full }]);
          } else {
            throw new Error("Stream ended before a reply completed.");
          }
          setStreamText("");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User pressed Stop: keep whatever was streamed so far.
          if (full) {
            setMessages((prev) => [...prev, { role: "assistant", content: full }]);
          }
          setStreamText("");
        } else {
          console.error("Tutor failed:", err);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "I couldn't finish that reply. Tap \"Try again\" to retry.", failed: true },
          ]);
        }
      } finally {
        setLoading(false);
        setStreaming(false);
      }
    },
    [messages, reviewer, loading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const copyMessage = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(index);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard unavailable
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
              {msg.failed && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={retryLast}
                    className="flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-brand hover:text-brand dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-brand-light"
                  >
                    <RotateCcw size={12} /> Try again
                  </button>
                </div>
              )}
              {msg.role === "assistant" && !msg.failed && (
                <button
                  onClick={() => copyMessage(msg.content, i)}
                  className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300"
                  aria-label="Copy reply"
                >
                  {copiedId === i ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  {copiedId === i ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          </div>
        ))}

        {streaming && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              <Bot size={16} />
            </div>
            <div className="rounded-2xl bg-zinc-100 px-4 py-3 dark:bg-zinc-800/80">
              {streamText ? (
                <p className="text-sm whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                  {streamText}
                  <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-brand align-middle" />
                </p>
              ) : (
                <Loader2 size={14} className="animate-spin text-zinc-500" />
              )}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
        <form
          className="flex gap-2"
          onSubmit={handleSubmit}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 2000))}
            maxLength={2000}
            placeholder="Ask me to explain a concept..."
            className="flex-1 rounded-xl border border-zinc-200 bg-transparent px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-zinc-800 dark:focus:border-brand-light"
            disabled={loading}
          />
          {streaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-red-200 bg-white text-red-500 transition hover:bg-red-50 dark:border-red-900/50 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/40"
              aria-label="Stop generating"
            >
              <Square size={14} className="fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              <Send size={16} className="ml-1" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}