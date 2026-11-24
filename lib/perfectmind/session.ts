import { PerfectMindHttp, UpstreamError } from "./client";
import {
  PM_CALENDAR_ID,
  PM_FALLBACK_SERVICE_ID,
  PM_MAP_ID,
  PM_PATHS,
  PM_WIDGET_ID,
  mapPageUrl,
} from "./config";
import { extractAntiForgeryToken, extractServices, makeDisplayNames, type PmFacility } from "./parser";
import type { BookingService } from "./booking";
import type { Facility } from "@/types";

/** Anonymous session lifetime before we proactively start a new one. */
const SESSION_MAX_AGE_MS = 20 * 60_000;

export interface PmContext {
  http: PerfectMindHttp;
  token: string;
  facilities: Facility[];
  service: BookingService & { durationIds: string[] };
  createdAt: number;
}

let current: { promise: Promise<PmContext>; createdAt: number } | null = null;

/**
 * Bootstrap an anonymous session the same way a browser does:
 * open the public map page (cookies + anti-forgery token), list facilities,
 * then open one facility landing page to read the badminton service configuration.
 */
async function bootstrap(): Promise<PmContext> {
  const http = new PerfectMindHttp();

  const mapHtml = await http.getHtml(mapPageUrl());
  let token = extractAntiForgeryToken(mapHtml);
  if (!token) throw new UpstreamError("No anti-forgery token on map page", "UPSTREAM_BAD_RESPONSE", false);

  const form = new URLSearchParams({
    take: "10000",
    skip: "0",
    page: "1",
    pageSize: "10000",
    ShouldCheckAvailability: "false",
    calendarId: PM_CALENDAR_ID,
    widgetId: PM_WIDGET_ID,
    mapId: PM_MAP_ID,
    filtersLoaded: "true",
    __RequestVerificationToken: token,
  });
  const data = await http.postJson<{ facilities?: PmFacility[] }>(PM_PATHS.facilities, form);
  const raw = (data.facilities ?? []).filter((f) => f?.ID && f?.Name);
  if (!raw.length) throw new UpstreamError("PerfectMind returned no facilities", "UPSTREAM_BAD_RESPONSE", true);

  // Stable order: by official name.
  raw.sort((a, b) => a.Name.localeCompare(b.Name, "en", { numeric: true }));
  const displayNames = makeDisplayNames(raw.map((f) => f.Name));
  const facilities: Facility[] = raw.map((f, i) => ({ id: f.ID, name: f.Name, displayName: displayNames[i] }));

  const landingUrl = `${PM_PATHS.landing}?facilityId=${encodeURIComponent(facilities[0].id)}&calendarId=${PM_CALENDAR_ID}&widgetId=${PM_WIDGET_ID}`;
  const landingHtml = await http.getHtml(landingUrl);
  token = extractAntiForgeryToken(landingHtml) ?? token;

  const svc = extractServices(landingHtml)[0];
  const duration30 = svc?.Durations?.find((d) => d.Duration === 30) ?? svc?.Durations?.[0];
  const durationIds = duration30?.DurationIDs ?? [];
  if (!durationIds.length) {
    throw new UpstreamError("Could not read badminton service durations", "UPSTREAM_BAD_RESPONSE", false);
  }

  return {
    http,
    token,
    facilities,
    service: {
      serviceId: svc?.ID ?? PM_FALLBACK_SERVICE_ID,
      durationId: durationIds[0],
      durationIds,
      feeType: duration30?.FeeType ?? 0,
    },
    createdAt: Date.now(),
  };
}

export function getContext(): Promise<PmContext> {
  if (current && Date.now() - current.createdAt < SESSION_MAX_AGE_MS) return current.promise;
  const promise = bootstrap();
  const entry = { promise, createdAt: Date.now() };
  current = entry;
  // Never cache a failed bootstrap.
  promise.catch(() => {
    if (current === entry) current = null;
  });
  return promise;
}

export function resetContext(ctx?: PmContext): void {
  // Only drop the session that actually failed, not a newer one created concurrently.
  if (!ctx || !current) {
    current = null;
    return;
  }
  current.promise.then(
    (c) => {
      if (c === ctx) current = null;
    },
    () => {},
  );
}
