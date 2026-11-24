import { describe, expect, it } from "vitest";
import { checkAccessKey, parseAccessKeys } from "@/lib/auth";
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

describe("access keys", () => {
  const A = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const B = "bbbbbbbbbbbbbbbbbbbbbbbb+/=";
  const LEGACY = "llllllllllllllllllllllll";
  const keys = parseAccessKeys({ BIRDIE_ACCESS_KEYS: ` me:${A} , group-1:${B} `, BIRDIE_ACCESS_KEY: LEGACY });

  it("parses named keys plus the legacy key as owner", () => {
    expect(keys.map((k) => k.name)).toEqual(["me", "group-1", "owner"]);
  });

  it("identifies which named key was used", () => {
    expect(checkAccessKey(`Bearer ${A}`, keys)).toEqual({ ok: true, name: "me" });
    expect(checkAccessKey(`bearer ${B}`, keys)).toEqual({ ok: true, name: "group-1" });
    expect(checkAccessKey(`Bearer ${LEGACY}`, keys)).toEqual({ ok: true, name: "owner" });
  });

  it("rejects wrong, missing or malformed credentials", () => {
    expect(checkAccessKey("Bearer wrong-key-wrong-key", keys)).toMatchObject({ ok: false, status: 401 });
    expect(checkAccessKey(A, keys)).toMatchObject({ ok: false, status: 401 });
    expect(checkAccessKey(null, keys)).toMatchObject({ ok: false, status: 401 });
  });

  it("skips malformed entries (bad name, short key, missing colon)", () => {
    const parsed = parseAccessKeys({ BIRDIE_ACCESS_KEYS: `bad name:${A},short:abc,${A},ok:${A}` });
    expect(parsed.map((k) => k.name)).toEqual(["ok"]);
  });

  it("fails closed when no key is configured", () => {
    expect(checkAccessKey(`Bearer ${A}`, parseAccessKeys({}))).toMatchObject({ ok: false, status: 500 });
  });

  it("a removed key stops working", () => {
    const after = parseAccessKeys({ BIRDIE_ACCESS_KEYS: `group-1:${B}` });
    expect(checkAccessKey(`Bearer ${A}`, after)).toMatchObject({ ok: false, status: 401 });
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
