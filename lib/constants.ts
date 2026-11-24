export const APP_NAME = "Birdie";
export const APP_ICON = "🏸";
export const TIMEZONE = "Australia/Melbourne";

export const SLOT_DURATION_MINUTES = 30;
/** Verified in Phase 0: the badminton service allows 30-minute bookings starting every 30 minutes. */
export const MIN_BOOKING_MINUTES = 30;

/** Verified in Phase 0: slots are bookable up to 14 days ahead; later days are listed but disabled. */
export const BOOKING_WINDOW_DAYS = 14;

/** Fallback opening hours when no facility reports them (verified 07:00–22:00 in Phase 0). */
export const DEFAULT_OPENING_TIME = "07:00";
export const DEFAULT_CLOSING_TIME = "22:00";

/** Time range shown before the user picks one. Only filters the view; it does not change upstream requests. */
export const DEFAULT_START_TIME = "16:00";
export const DEFAULT_END_TIME = "18:00";

// Backend cache
export const AVAILABILITY_CACHE_TTL_SECONDS = 30;
export const FAILED_CACHE_TTL_SECONDS = 5;
export const FACILITY_CACHE_TTL_SECONDS = 86_400;

// Client data freshness (§5.7)
export const DATA_STALE_AFTER_SECONDS = 120;
export const DATA_EXPIRED_AFTER_SECONDS = 600;

// Upstream request control
export const UPSTREAM_CONCURRENCY = 3;
export const UPSTREAM_TIMEOUT_MS = 10_000;

export const STORAGE_KEYS = {
  preferences: "birdie.preferences",
  accessKey: "birdie.accessKey",
} as const;
