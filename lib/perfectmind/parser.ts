/**
 * Pure parsing helpers for PerfectMind responses. No network access here so it can be unit-tested.
 *
 * Verified semantics (Phase 0, 2026-11-24):
 * - FacilityAvailability returns one entry per day with OpeningTime / ClosingTime.
 * - AvailableSpots lists only bookable start times; any slot inside opening hours that is
 *   missing is taken. Spots with IsDisabled=true are outside the booking window.
 * - `Date` is the Melbourne calendar date encoded as UTC midnight, e.g. /Date(1795564800000)/ = 2026-11-25.
 * - Spot `Ticks` are .NET ticks of the Melbourne wall-clock start time; the official site uses them
 *   verbatim as `startDateTimeTicks` in the booking link. They exceed Number.MAX_SAFE_INTEGER, so we
 *   recompute them exactly with BigInt (see wallClockTicks) instead of trusting JSON.parse.
 */
import { MIN_BOOKING_MINUTES, SLOT_DURATION_MINUTES } from "../constants";
import type { AvailabilityStatus } from "@/types";

export interface PmTimeSpan {
  TotalMinutes?: number;
}

export interface PmSpot {
  Time?: PmTimeSpan;
  Duration?: PmTimeSpan;
  IsDisabled?: boolean;
}

export interface PmDay {
  Date?: string | number;
  OpeningTime?: PmTimeSpan;
  ClosingTime?: PmTimeSpan;
  BookingGroups?: { Name?: string; AvailableSpots?: PmSpot[] }[];
}

export interface PmAvailabilityResponse {
  availabilities?: PmDay[];
}

export interface PmFacility {
  ID: string;
  Name: string;
}

export interface PmService {
  ID: string;
  Name?: string;
  StartsEvery?: number;
  Durations?: { Duration: number; FeeType?: number; DurationIDs?: string[] }[];
}

/** PerfectMind day value -> "YYYY-MM-DD". */
export function parsePmDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  let ms: number | null = null;
  if (typeof value === "number" && Number.isFinite(value)) ms = value;
  else {
    const s = String(value).trim();
    const m = s.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
    if (m) ms = Number(m[1]);
    else if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  }
  if (ms == null || Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

export interface NormalizedSpot {
  start: number;
  open: boolean;
}

export interface NormalizedDay {
  openingMinutes: number;
  closingMinutes: number;
  spots: Map<number, NormalizedSpot>;
}

/** Compute .NET ticks for a Melbourne wall-clock time: ticks since 0001-01-01 treating local time as UTC. */
export function wallClockTicks(date: string, minutes: number): string {
  const EPOCH_TICKS = 621_355_968_000_000_000n;
  const ms = BigInt(Date.parse(`${date}T00:00:00Z`)) + BigInt(minutes) * 60_000n;
  return (EPOCH_TICKS + ms * 10_000n).toString();
}

/** Extract the requested day from a FacilityAvailability response. Returns null if the day is absent. */
export function normalizeDay(data: PmAvailabilityResponse, date: string): NormalizedDay | null {
  const day = (data.availabilities ?? []).find((d) => parsePmDate(d.Date) === date);
  if (!day) return null;

  const spots = new Map<number, NormalizedSpot>();
  for (const group of day.BookingGroups ?? []) {
    for (const spot of group.AvailableSpots ?? []) {
      const start = spot.Time?.TotalMinutes;
      if (typeof start !== "number" || !Number.isFinite(start)) continue;
      const duration = spot.Duration?.TotalMinutes ?? SLOT_DURATION_MINUTES;
      if (duration !== SLOT_DURATION_MINUTES) continue;
      const open = spot.IsDisabled !== true;
      const prev = spots.get(start);
      // Multiple duration/price IDs can repeat the same spot: keep it open if any copy is open.
      if (!prev || (open && !prev.open)) {
        spots.set(start, { start, open });
      }
    }
  }

  const starts = [...spots.keys()];
  const openingMinutes = day.OpeningTime?.TotalMinutes ?? (starts.length ? Math.min(...starts) : 0);
  const closingMinutes =
    day.ClosingTime?.TotalMinutes ?? (starts.length ? Math.max(...starts) + SLOT_DURATION_MINUTES : 0);
  return { openingMinutes, closingMinutes, spots };
}

export interface ParsedSlot {
  startMinutes: number;
  status: AvailabilityStatus;
}

/**
 * Expand a day into contiguous 30-minute slots over opening hours.
 * A slot is available only if a booking of MIN_BOOKING_MINUTES can start there (§5.4).
 */
export function expandSlots(day: NormalizedDay, minBookingMinutes = MIN_BOOKING_MINUTES): ParsedSlot[] {
  const needed = Math.max(1, Math.ceil(minBookingMinutes / SLOT_DURATION_MINUTES));
  const slots: ParsedSlot[] = [];
  for (let t = day.openingMinutes; t + SLOT_DURATION_MINUTES <= day.closingMinutes; t += SLOT_DURATION_MINUTES) {
    let ok = true;
    for (let k = 0; k < needed; k++) {
      const s = day.spots.get(t + k * SLOT_DURATION_MINUTES);
      if (!s?.open) {
        ok = false;
        break;
      }
    }
    slots.push({ startMinutes: t, status: ok ? "available" : "unavailable" });
  }
  return slots;
}

/**
 * Short, unique display names: "East A" -> "A" when the trailing token is unique across all courts;
 * otherwise keep the full official name to avoid booking the wrong court.
 */
export function makeDisplayNames(names: string[]): string[] {
  const short = names.map((n) => {
    const cleaned = n.replace(/\b(stadium|court|badminton)\b/gi, " ").trim().split(/\s+/);
    return cleaned[cleaned.length - 1] || n;
  });
  const counts = new Map<string, number>();
  for (const s of short) counts.set(s.toLowerCase(), (counts.get(s.toLowerCase()) ?? 0) + 1);
  return names.map((n, i) => (counts.get(short[i].toLowerCase()) === 1 ? short[i] : n));
}

/** Pull the services array out of the landing page's `new MainViewModel({ services: [...] , ... })`. */
export function extractServices(html: string): PmService[] {
  const m = html.match(/services:\s*(\[[\s\S]*?\]),\s*availabilityUrl:/m);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function extractAntiForgeryToken(html: string): string | null {
  return (
    html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)?.[1] ??
    html.match(/value="([^"]+)"[^>]*name="__RequestVerificationToken"/)?.[1] ??
    null
  );
}
