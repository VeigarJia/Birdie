import { SLOT_DURATION_MINUTES, TIMEZONE } from "./constants";

/** "HH:mm" -> minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** minutes since midnight -> "HH:mm". */
export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Slot start times in [start, end), stepping by the slot duration. */
export function buildTimeRows(startTime: string, endTime: string): string[] {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const rows: string[] = [];
  for (let t = start; t + SLOT_DURATION_MINUTES <= end; t += SLOT_DURATION_MINUTES) {
    rows.push(toHHMM(t));
  }
  return rows;
}

/** Current wall-clock date and minutes in Melbourne, independent of the host timezone. */
export function melbourneNow(now: Date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** Add whole days to a "YYYY-MM-DD" calendar date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-25" -> "25 Nov 2026" (DD MMM YYYY). */
export function formatDisplayDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const month = d.toLocaleString("en-AU", { month: "short", timeZone: "UTC" });
  return `${String(d.getUTCDate()).padStart(2, "0")} ${month} ${d.getUTCFullYear()}`;
}

/** Short weekday, e.g. "Wed". */
export function formatWeekday(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleString("en-AU", { weekday: "short", timeZone: "UTC" });
}

/**
 * Offset (minutes east of UTC) of Melbourne at the given instant, e.g. 660 for AEDT.
 * Used to express a Melbourne wall-clock time as an absolute instant.
 */
export function melbourneOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    timeZoneName: "longOffset",
  }).formatToParts(at);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Melbourne wall-clock date + "HH:mm" -> absolute Date. DST-safe for non-ambiguous times. */
export function melbourneToInstant(date: string, hhmm: string): Date {
  const naiveUtc = new Date(`${date}T${hhmm}:00Z`);
  const guess = new Date(naiveUtc.getTime() - melbourneOffsetMinutes(naiveUtc) * 60_000);
  // Re-evaluate the offset at the guessed instant to handle DST transitions.
  return new Date(naiveUtc.getTime() - melbourneOffsetMinutes(guess) * 60_000);
}

/** "Updated just now" / "15 seconds ago" / "3 minutes ago". */
export function formatAge(seconds: number): string {
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${Math.floor(seconds)} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}
