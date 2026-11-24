"use client";

import { formatAge } from "@/lib/time";
import type { DataFreshness } from "@/types";

interface Props {
  updatedAt: string | null;
  nowMs: number;
  freshness: DataFreshness;
  refreshing: boolean;
  partial: boolean;
}

export function AvailabilityHeader({ updatedAt, nowMs, freshness, refreshing, partial }: Props) {
  let status: React.ReactNode = null;
  if (refreshing) status = <span className="text-muted">Updating…</span>;
  else if (updatedAt) {
    const age = Math.max(0, (nowMs - Date.parse(updatedAt)) / 1000);
    const tone = freshness === "fresh" ? "text-muted" : freshness === "stale" ? "text-warn" : "text-danger";
    status = <span className={tone}>Updated {formatAge(age)}</span>;
  }
  return (
    <div className="mt-5 mb-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">Availability</h2>
        <span className="text-xs" aria-live="polite">
          {status}
        </span>
      </div>
      {freshness === "expired" && updatedAt && !refreshing && (
        <p className="mt-1 text-xs text-danger">Data is out of date. Refresh before booking.</p>
      )}
      {partial && <p className="mt-1 text-xs text-unknown-fg">Some courts couldn&apos;t be loaded. Free counts may be incomplete.</p>}
    </div>
  );
}
