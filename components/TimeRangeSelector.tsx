"use client";

import { SLOT_DURATION_MINUTES } from "@/lib/constants";
import { toHHMM, toMinutes } from "@/lib/time";

interface Props {
  startTime: string;
  endTime: string;
  open: string;
  close: string;
  onChange: (startTime: string, endTime: string) => void;
}

function range(from: number, to: number): string[] {
  const out: string[] = [];
  for (let t = from; t <= to; t += SLOT_DURATION_MINUTES) out.push(toHHMM(t));
  return out;
}

function Picker({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex-1">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-[10px] border border-line bg-surface pl-3 pr-8 text-base tabular-nums text-text"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    </label>
  );
}

export function TimeRangeSelector({ startTime, endTime, open, close, onChange }: Props) {
  const o = toMinutes(open);
  const c = toMinutes(close);
  const s = toMinutes(startTime);
  const starts = range(o, c - SLOT_DURATION_MINUTES);
  const ends = range(s + SLOT_DURATION_MINUTES, c);
  return (
    <div className="mt-3 flex gap-3">
      <Picker
        label="Start time"
        value={startTime}
        options={starts}
        onChange={(v) => {
          // Keep end after start: push the end forward if needed.
          const end = toMinutes(endTime) <= toMinutes(v) ? toHHMM(toMinutes(v) + SLOT_DURATION_MINUTES) : endTime;
          onChange(v, end);
        }}
      />
      <Picker label="End time" value={endTime} options={ends} onChange={(v) => onChange(startTime, v)} />
    </div>
  );
}
