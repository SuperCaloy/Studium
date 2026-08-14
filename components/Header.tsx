"use client";

import ThemeToggle from "./ThemeToggle";

function Mark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 6.5C10 4.4 6.4 4.2 3.6 5.2V17C6.4 16 10 16.2 12 18.2C14 16.2 17.6 16 20.4 17V5.2C17.6 4.2 14 4.4 12 6.5Z" />
      <path d="M12 6.5V18.2" />
    </svg>
  );
}

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-zinc-50/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
            <Mark />
          </div>
          <div className="flex items-baseline leading-none">
            <span className="font-display text-[17px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Studium
            </span>
            <span className="ml-2 hidden rounded-full border border-brand/25 bg-brand/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand sm:inline-block dark:border-brand/40 dark:bg-brand/10 dark:text-brand-light">
              Study reviewer
            </span>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
