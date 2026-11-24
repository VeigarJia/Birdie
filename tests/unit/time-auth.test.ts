import { describe, expect, it } from "vitest";
import { exactSlotUrl, facilityDateUrl } from "@/lib/perfectmind/booking";
import { addDays, buildTimeRows, formatDisplayDate, melbourneNow, melbourneToInstant } from "@/lib/time";
import { validateDate } from "@/lib/validation";

describe("time", () => {
  it("uses Melbourne local date regardless of host timezone", () => {
    // 2026-11-24T14:30Z is 01:30 on the 25th in Melbourne (AEDT, UTC+11).
    expect(melbourneNow(new Date("2026-11-24T14:30:00Z"))).toEqual({ date: "2026-11-25", minutes: 90 });
  });
  it("converts Melbourne wall-clock to instants across DST", () => {
    expect(melbourneToInstant("2026-11-25", "12:00").toISOString()).toBe("2026-11-25T01:00:00.000Z"); // AEDT
    expect(melbourneToInstant("2026-06-15", "12:00").toISOString()).toBe("2026-06-15T02:00:00.000Z"); // AEST
  });
  it("builds rows and formats dates", () => {
    expect(buildTimeRows("17:00", "19:00")).toEqual(["17:00", "17:30", "18:00", "18:30"]);
    expect(buildTimeRows("17:00", "17:00")).toEqual([]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(formatDisplayDate("2026-11-25")).toBe("25 Nov 2026");
  });
});

describe("validateDate", () => {
  const now = new Date("2026-11-24T06:00:00Z"); // 17:00 Melbourne
  it("accepts today through the 14-day window", () => {
    expect(validateDate("2026-11-24", now)).toBeNull();
    expect(validateDate("2026-12-08", now)).toBeNull();
  });
  it("rejects past, far-future and malformed dates", () => {
    expect(validateDate("2026-11-23", now)).toMatch(/past/);
    expect(validateDate("2026-12-09", now)).toMatch(/window/);
    expect(validateDate("2026-02-30", now)).toMatch(/valid/);
    expect(validateDate("25/11/2026", now)).toMatch(/YYYY/);
    expect(validateDate(null, now)).not.toBeNull();
  });
});

describe("booking links", () => {
  const svc = { serviceId: "svc", durationId: "dur", feeType: 0 };
  it("builds the exact-slot link like the official page", () => {
    const u = new URL(exactSlotUrl("fac", "2026-11-26", 420, svc));
    expect(u.origin).toBe("https://unimelb.perfectmind.com");
    expect(u.pathname).toBe("/32617/Clients/BookMe4EventParticipants/FacilityBooking");
    expect(u.searchParams.get("startDateTimeTicks")).toBe("639312732000000000");
    expect(u.searchParams.get("facilityId")).toBe("fac");
    expect(u.searchParams.get("durationId")).toBe("dur");
  });
  it("builds the facility/date fallback link", () => {
    const u = new URL(facilityDateUrl("fac", "2026-11-26"));
    expect(u.pathname).toBe("/32617/Clients/BookMe4LandingPages/Facility");
    expect(u.searchParams.get("arrivalDate")).toBe("2026-11-26T01:00:00.000Z");
  });
});
