"use client";

import type { MatrixCell } from "@/lib/matrix";

const base = "flex h-11 items-center justify-center rounded-[5px] text-[15px] select-none";

export function AvailabilityCell({ cell, time, clickable }: { cell: MatrixCell; time: string; clickable: boolean }) {
  const name = cell.facility.displayName;
  switch (cell.status) {
    case "available":
      if (clickable && cell.bookingUrl) {
        return (
          <a
            href={cell.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Book court ${name} at ${time}`}
            className={`${base} bg-available-bg font-semibold text-available-fg active:brightness-90`}
          >
            ✓
          </a>
        );
      }
      return (
        <div className={`${base} bg-available-bg text-available-fg opacity-45`} aria-label={`Court ${name} at ${time}: available, refresh to book`}>
          ✓
        </div>
      );
    case "unavailable":
      return <div className={`${base} bg-unavailable-bg text-unavailable-fg`} aria-label={`Court ${name} at ${time}: unavailable`}>–</div>;
    case "unknown":
      return <div className={`${base} bg-unknown-bg font-medium text-unknown-fg`} aria-label={`Court ${name} at ${time}: unknown`}>?</div>;
    case "past":
      return <div className={`${base} bg-past-bg`} aria-label={`Court ${name} at ${time}: past`} />;
    case "loading":
      return <div className={`${base} skeleton bg-unavailable-bg`} aria-hidden />;
  }
}
