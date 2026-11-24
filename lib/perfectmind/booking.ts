import { PM_CALENDAR_ID, PM_ORIGIN, PM_PATHS, PM_WIDGET_ID, mapPageUrl } from "./config";
import { wallClockTicks } from "./parser";
import { melbourneToInstant } from "../time";

export interface BookingService {
  serviceId: string;
  durationId: string;
  feeType: number;
}

/**
 * Level 2: exact-slot link, built exactly like the official landing page's `createBookingLink`.
 * The user lands on the booking form for that court and start time (after logging in).
 * Verified on device 2026-11-24, but not used: it fixes the booking at 30 minutes.
 * Birdie links to facilityDateUrl instead so users can choose a longer duration.
 */
export function exactSlotUrl(facilityId: string, date: string, startMinutes: number, service: BookingService): string {
  const u = new URL(PM_PATHS.booking, PM_ORIGIN);
  u.searchParams.set("facilityId", facilityId);
  u.searchParams.set("widgetId", PM_WIDGET_ID);
  u.searchParams.set("calendarId", PM_CALENDAR_ID);
  u.searchParams.set("serviceId", service.serviceId);
  u.searchParams.set("duration", "30");
  u.searchParams.set("durationId", service.durationId);
  u.searchParams.set("startDateTimeTicks", wallClockTicks(date, startMinutes));
  u.searchParams.set("numberOfAttendees", "1");
  u.searchParams.set("numberOfNights", "1");
  u.searchParams.set("feeType", String(service.feeType));
  u.searchParams.set("landingPageBackUrl", "");
  return u.href;
}

/** Level 1 (used): the court's landing page opened on the chosen date; duration and time are picked there. */
export function facilityDateUrl(facilityId: string, date: string): string {
  const u = new URL(PM_PATHS.landing, PM_ORIGIN);
  u.searchParams.set("facilityId", facilityId);
  u.searchParams.set("arrivalDate", melbourneToInstant(date, "12:00").toISOString());
  u.searchParams.set("calendarId", PM_CALENDAR_ID);
  u.searchParams.set("widgetId", PM_WIDGET_ID);
  u.searchParams.set("landingPageBackUrl", mapPageUrl());
  return u.href;
}
