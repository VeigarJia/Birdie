"use client";

import { addDays, formatDisplayDate, formatWeekday } from "@/lib/time";

interface Props {
  date: string;
  min: string;
  max: string;
  today: string;
  onChange: (date: string) => void;
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

export function DateSelector({ date, min, max, today, onChange }: Props) {
  const label = date === today ? "Today" : formatWeekday(date);
  const btn = "flex h-11 w-11 items-center justify-center rounded-full text-text active:bg-surface disabled:opacity-25";
  return (
    <div className="mt-2 flex items-center justify-between">
      <button type="button" className={btn} disabled={date <= min} onClick={() => onChange(addDays(date, -1))} aria-label="Previous day">
        <Chevron dir="left" />
      </button>
      <label className="relative flex flex-col items-center px-4 py-1">
        <span className="text-base font-medium">{formatDisplayDate(date)}</span>
        <span className="text-xs text-muted">{label}</span>
        {/* Transparent native picker over the label: tapping the date opens the system date picker. */}
        <input
          type="date"
          value={date}
          min={min}
          max={max}
          aria-label="Choose date"
          onChange={(e) => {
            const v = e.target.value;
            if (v && v >= min && v <= max) onChange(v);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <button type="button" className={btn} disabled={date >= max} onClick={() => onChange(addDays(date, 1))} aria-label="Next day">
        <Chevron dir="right" />
      </button>
    </div>
  );
}
