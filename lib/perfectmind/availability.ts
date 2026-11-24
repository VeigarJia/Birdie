import { AVAILABILITY_CACHE_TTL_SECONDS, FAILED_CACHE_TTL_SECONDS, TIMEZONE, UPSTREAM_CONCURRENCY } from "../constants";
import { TtlCache, mapLimit } from "../cache";
import { melbourneToInstant, toHHMM } from "../time";
import { UpstreamError } from "./client";
import { PM_CALENDAR_ID, PM_PATHS, PM_WIDGET_ID } from "./config";
import { exactSlotUrl } from "./booking";
import { expandSlots, normalizeDay, type PmAvailabilityResponse } from "./parser";
import { getContext, resetContext, type PmContext } from "./session";
import type { AvailabilityResponse, Facility, FacilityAvailability } from "@/types";

const cache = new TtlCache<AvailabilityResponse>();

async function fetchRaw(ctx: PmContext, facilityId: string, date: string): Promise<PmAvailabilityResponse> {
  const form = new URLSearchParams({
    facilityId,
    date: melbourneToInstant(date, "12:00").toISOString(),
    daysCount: "1",
    duration: "30",
    serviceId: ctx.service.serviceId,
    widgetId: PM_WIDGET_ID,
    calendarId: PM_CALENDAR_ID,
  });
  for (const id of ctx.service.durationIds) form.append("durationIds[]", id);
  form.set("__RequestVerificationToken", ctx.token);
  return ctx.http.postJson<PmAvailabilityResponse>(PM_PATHS.availability, form);
}

function toFacilityAvailability(
  ctx: PmContext,
  facility: Facility,
  date: string,
  raw: PmAvailabilityResponse,
  fetchedAt: string,
): FacilityAvailability {
  const day = normalizeDay(raw, date);
  if (!day) {
    // Day absent from a successful response: nothing bookable (e.g. later today, or outside the window).
    return { facility, status: "success", updatedAt: fetchedAt, openingTime: null, closingTime: null, slots: [] };
  }
  const slots = expandSlots(day).map((s) => {
    const available = s.status === "available";
    return {
      start: toHHMM(s.startMinutes),
      end: toHHMM(s.startMinutes + 30),
      status: s.status,
      bookingUrl: available ? exactSlotUrl(facility.id, date, s.startMinutes, ctx.service) : null,
      bookingLinkType: available ? ("exact-slot" as const) : null,
    };
  });
  return {
    facility,
    status: "success",
    updatedAt: fetchedAt,
    openingTime: toHHMM(day.openingMinutes),
    closingTime: toHHMM(day.closingMinutes),
    slots,
  };
}

async function loadOnce(date: string): Promise<{ result: AvailabilityResponse; sessionFailed: PmContext | null }> {
  const ctx = await getContext();
  let sessionFailed: PmContext | null = null;

  const facilities = await mapLimit(ctx.facilities, UPSTREAM_CONCURRENCY, async (facility) => {
    try {
      const raw = await fetchRaw(ctx, facility.id, date);
      return toFacilityAvailability(ctx, facility, date, raw, new Date().toISOString());
    } catch (err) {
      if (err instanceof UpstreamError && err.code === "UPSTREAM_SESSION") sessionFailed = ctx;
      console.error(`[birdie] availability failed for ${facility.name}: ${(err as Error).message}`);
      const failed: FacilityAvailability = {
        facility,
        status: "failed",
        updatedAt: null,
        openingTime: null,
        closingTime: null,
        slots: [],
      };
      return failed;
    }
  });

  const succeeded = facilities.filter((f) => f.status === "success");
  const updatedAt = succeeded.reduce<string>(
    (min, f) => (f.updatedAt && f.updatedAt < min ? f.updatedAt : min),
    new Date().toISOString(),
  );
  return {
    result: {
      date,
      timezone: TIMEZONE,
      slotDuration: 30,
      updatedAt,
      partial: succeeded.length > 0 && succeeded.length < facilities.length,
      facilities,
    },
    sessionFailed,
  };
}

/** Aggregate availability for every badminton court on a date, with caching and one session retry. */
export async function getAvailability(date: string, opts: { refresh?: boolean } = {}): Promise<AvailabilityResponse> {
  return cache.getOrLoad(
    `availability:badminton:${date}:30`,
    async () => {
      let { result, sessionFailed } = await loadOnce(date);
      if (sessionFailed) {
        // Anonymous session probably expired: start a new one and retry once.
        resetContext(sessionFailed);
        ({ result } = await loadOnce(date));
      }
      if (result.facilities.every((f) => f.status === "failed")) {
        throw new UpstreamError("All facility availability requests failed", "UPSTREAM_UNAVAILABLE", true);
      }
      const ttl = result.partial ? FAILED_CACHE_TTL_SECONDS : AVAILABILITY_CACHE_TTL_SECONDS;
      return { value: result, ttlSeconds: ttl };
    },
    opts.refresh,
  );
}
