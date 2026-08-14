"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

export default function AlertModal({
  isOpen,
  title = "Warning",
  message,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      document.body.style.overflow = "hidden";
    } else {
      if (dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        // Close if clicking on the backdrop
        const rect = dialogRef.current?.getBoundingClientRect();
        if (rect) {
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          ) {
            onClose();
          }
        }
      }}
      className="m-auto max-w-md w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 animate-slide-up"
      style={{ animationDuration: "200ms" }}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 dark:bg-amber-400/10 dark:text-amber-400">
          <AlertTriangle size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {message}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-xl bg-brand px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-dark active:scale-[0.98]"
        >
          OK
        </button>
      </div>
    </dialog>
  );
}
