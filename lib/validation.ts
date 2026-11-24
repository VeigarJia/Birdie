import { BOOKING_WINDOW_DAYS } from "./constants";
import { addDays, melbourneNow } from "./time";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Earliest and latest queryable dates (Melbourne calendar). */
export function dateBounds(now: Date = new Date()): { min: string; max: string } {
  const today = melbourneNow(now).date;
  return { min: today, max: addDays(today, BOOKING_WINDOW_DAYS) };
}

export function validateDate(date: string | null, now: Date = new Date()): string | null {
  if (!date || !DATE_RE.test(date)) return "date must be YYYY-MM-DD";
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return "date is not a valid calendar date";
  const { min, max } = dateBounds(now);
  if (date < min) return "date is in the past";
  if (date > max) return `date is beyond the ${BOOKING_WINDOW_DAYS}-day booking window`;
  return null;
}
