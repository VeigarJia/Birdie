"use client";

import { AvailabilityCell } from "./AvailabilityCell";
import type { MatrixRow } from "@/lib/matrix";
import type { Facility } from "@/types";

interface Props {
  facilities: Facility[];
  rows: MatrixRow[];
  clickable: boolean;
}

/**
 * Time column and court header stay pinned. Rows are 44px tall; court columns are at least
 * 32px and share any extra width; below that the matrix scrolls horizontally (§6.5).
 */
export function AvailabilityMatrix({ facilities, rows, clickable }: Props) {
  const cols = `3rem repeat(${facilities.length}, minmax(32px, 1fr)) 2.5rem`;
  return (
    <div className="-mx-4 overflow-x-auto px-4" role="table" aria-label="Court availability">
      <div className="min-w-max sm:min-w-0" style={{ display: "grid", gridTemplateColumns: cols, columnGap: 2, rowGap: 2 }}>
        <div role="row" className="contents">
          <div role="columnheader" className="sticky top-0 left-0 z-20 bg-bg py-1.5 text-xs text-muted">Time</div>
          {facilities.map((f) => (
            <div key={f.id} role="columnheader" title={f.name} className="sticky top-0 z-10 truncate bg-bg py-1.5 text-center text-[13px] font-medium">
              {f.displayName}
            </div>
          ))}
          <div role="columnheader" className="sticky top-0 z-10 bg-bg py-1.5 text-right text-xs text-muted">Free</div>
        </div>
        {rows.map((row) => (
          <div role="row" key={row.time} className="contents">
            <div role="rowheader" className="sticky left-0 z-10 flex h-11 items-center bg-bg text-[13px] tabular-nums text-muted">
              {row.time}
            </div>
            {row.cells.map((cell) => (
              <div role="cell" key={cell.facility.id}>
                <AvailabilityCell cell={cell} time={row.time} clickable={clickable} />
              </div>
            ))}
            <div role="cell" className={`flex h-11 items-center justify-end text-[14px] font-semibold tabular-nums ${row.free > 0 ? "text-available-fg" : "text-unavailable-fg"}`}>
              {row.free}
              {row.incomplete && <span className="text-unknown-fg">*</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatrixSkeleton({ columns = 8, rows = 8 }: { columns?: number; rows?: number }) {
  const cols = `3rem repeat(${columns}, minmax(32px, 1fr)) 2.5rem`;
  return (
    <div aria-busy="true" aria-label="Loading availability" style={{ display: "grid", gridTemplateColumns: cols, gap: 2 }} className="mt-8">
      {Array.from({ length: rows * (columns + 2) }, (_, i) => {
        const col = i % (columns + 2);
        const edge = col === 0 || col === columns + 1;
        return <div key={i} className={`h-11 rounded-[5px] ${edge ? "" : "skeleton bg-unavailable-bg"}`} />;
      })}
    </div>
  );
}
