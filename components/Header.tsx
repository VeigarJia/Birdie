"use client";

export function Header({ refreshing, onRefresh, disabled }: { refreshing: boolean; onRefresh: () => void; disabled?: boolean }) {
  return (
    <header className="flex items-center justify-between pt-3">
      <h1 className="text-[26px] font-semibold tracking-tight">
        <span aria-hidden>🏸</span> Birdie
      </h1>
      <button
        type="button"
        onClick={onRefresh}
        disabled={disabled || refreshing}
        aria-label={refreshing ? "Refreshing" : "Refresh availability"}
        className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-accent active:bg-surface disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className={`h-[22px] w-[22px] ${refreshing ? "spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 11a8 8 0 1 0-2.3 5.7" />
          <path d="M20 4v7h-7" />
        </svg>
      </button>
    </header>
  );
}
