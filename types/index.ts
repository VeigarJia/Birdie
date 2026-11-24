export interface Facility {
  id: string;
  name: string;
  displayName: string;
}

/** Statuses the backend can assert. Past / loading / freshness are computed on the client. */
export type AvailabilityStatus = "available" | "unavailable" | "unknown";

export type BookingLinkType = "facility-date" | "exact-slot";

export interface AvailabilitySlot {
  /** "HH:mm", Melbourne local time. */
  start: string;
  end: string;
  status: AvailabilityStatus;
  bookingUrl: string | null;
  bookingLinkType: BookingLinkType | null;
}

export interface FacilityAvailability {
  facility: Facility;
  status: "success" | "failed";
  updatedAt: string | null;
  /** Opening hours for the day as "HH:mm", null when the facility is closed or failed. */
  openingTime: string | null;
  closingTime: string | null;
  slots: AvailabilitySlot[];
}

export interface AvailabilityResponse {
  date: string;
  timezone: string;
  slotDuration: 30;
  /** When the upstream data was actually fetched (not when this response was served). */
  updatedAt: string;
  partial: boolean;
  facilities: FacilityAvailability[];
}

export interface ApiError {
  error: { code: string; message: string; retryable: boolean };
}

export interface UserPreferences {
  startTime: string;
  endTime: string;
}

export type CellDisplayStatus = AvailabilityStatus | "past" | "loading";

export type DataFreshness = "fresh" | "stale" | "expired";
