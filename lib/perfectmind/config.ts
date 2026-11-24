/**
 * PerfectMind tenant configuration for Melbourne University Sport badminton.
 * IDs verified against the live site in Phase 0 (2026-11-24).
 */
export const PM_ORIGIN = "https://unimelb.perfectmind.com";
export const PM_ORG_PATH = "/32617";

export const PM_MAP_ID = "7d8b8d20-b7cf-43ac-8167-0738142baff3";
export const PM_WIDGET_ID = "15f6af07-39c5-473e-b053-96653f77a406";
export const PM_CALENDAR_ID = "bce15730-1f38-4e5c-889c-856322a7f877";

/** Fallback when the landing page cannot be parsed ("Badminton Hire"). */
export const PM_FALLBACK_SERVICE_ID = "e413294c-507d-4653-b25e-c30c09be2e3f";

export const PM_PATHS = {
  map: `${PM_ORG_PATH}/Clients/BookMe4FacilityMap/Map`,
  facilities: `${PM_ORG_PATH}/Clients/BookMe4FacilityMap/GetFacilities`,
  landing: `${PM_ORG_PATH}/Clients/BookMe4LandingPages/Facility`,
  availability: `${PM_ORG_PATH}/Clients/BookMe4LandingPages/FacilityAvailability`,
  booking: `${PM_ORG_PATH}/Clients/BookMe4EventParticipants/FacilityBooking`,
} as const;

export const PM_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

export function mapPageUrl(): string {
  const u = new URL(PM_PATHS.map, PM_ORIGIN);
  u.searchParams.set("mapId", PM_MAP_ID);
  u.searchParams.set("widgetId", PM_WIDGET_ID);
  u.searchParams.set("calendarId", PM_CALENDAR_ID);
  return u.href;
}
