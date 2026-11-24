import { DATA_EXPIRED_AFTER_SECONDS, DATA_STALE_AFTER_SECONDS, DEFAULT_CLOSING_TIME, DEFAULT_OPENING_TIME, SLOT_DURATION_MINUTES } from "./constants";
import { buildTimeRows, toHHMM, toMinutes } from "./time";
import type { AvailabilityResponse, CellDisplayStatus, DataFreshness, Facility } from "@/types";

export interface MatrixCell {
  facility: Facility;
  status: CellDisplayStatus;
  bookingUrl: string | null;
}

export interface MatrixRow {
  time: string;
  cells: MatrixCell[];
  /** Confirmed available courts in this row. */
  free: number;
  /** True when at least one court in this row could not be determined. */
  incomplete: boolean;
}

/** Earliest opening / latest closing across courts, falling back to the verified defaults. */
export function openingRange(data: AvailabilityResponse | null): { open: string; close: string } {
  const opens = data?.facilities.map((f) => f.openingTime).filter((t): t is string => !!t) ?? [];
  const closes = data?.facilities.map((f) => f.closingTime).filter((t): t is string => !!t) ?? [];
  return {
    open: opens.length ? opens.reduce((a, b) => (a < b ? a : b)) : DEFAULT_OPENING_TIME,
    close: closes.length ? closes.reduce((a, b) => (a > b ? a : b)) : DEFAULT_CLOSING_TIME,
  };
}

/** Keep a saved range inside opening hours and non-empty. */
export function clampRange(
  start: string | undefined,
  end: string | undefined,
  open: string,
  close: string,
): { startTime: string; endTime: string } {
  const o = toMinutes(open);
  const c = toMinutes(close);
  const snap = (m: number) => Math.round(m / SLOT_DURATION_MINUTES) * SLOT_DURATION_MINUTES;
  let s = start ? snap(toMinutes(start)) : o;
  let e = end ? snap(toMinutes(end)) : c;
  s = Math.min(Math.max(s, o), c - SLOT_DURATION_MINUTES);
  e = Math.min(Math.max(e, s + SLOT_DURATION_MINUTES), c);
  return { startTime: toHHMM(s), endTime: toHHMM(e) };
}

export function freshness(updatedAt: string | null, nowMs: number, online: boolean): DataFreshness {
  if (!online || !updatedAt) return "expired";
  const age = (nowMs - Date.parse(updatedAt)) / 1000;
  if (age > DATA_EXPIRED_AFTER_SECONDS) return "expired";
  if (age > DATA_STALE_AFTER_SECONDS) return "stale";
  return "fresh";
}

/**
 * Build the visible matrix.
 * `nowMinutes` is the current Melbourne time when viewing today, otherwise null (no Past cells).
 */
export function buildMatrix(
  data: AvailabilityResponse,
  startTime: string,
  endTime: string,
  nowMinutes: number | null,
): MatrixRow[] {
  return buildTimeRows(startTime, endTime).map((time) => {
    const start = toMinutes(time);
    const cells = data.facilities.map<MatrixCell>((fa) => {
      if (fa.status === "failed") return { facility: fa.facility, status: "unknown", bookingUrl: null };
      const slot = fa.slots.find((s) => s.start === time);
      // Successful response without this slot: outside opening hours or nothing bookable.
      let status: CellDisplayStatus = slot?.status ?? "unavailable";
      let bookingUrl = slot?.status === "available" ? slot.bookingUrl : null;
      if (nowMinutes != null) {
        const ended = start + SLOT_DURATION_MINUTES <= nowMinutes;
        const started = start <= nowMinutes;
        // A started slot stays bookable only if the official system still offers it.
        if (ended || (started && status !== "available")) {
          status = "past";
          bookingUrl = null;
        }
      }
      return { facility: fa.facility, status, bookingUrl };
    });
    return {
      time,
      cells,
      free: cells.filter((c) => c.status === "available").length,
      incomplete: cells.some((c) => c.status === "unknown"),
    };
  });
}
