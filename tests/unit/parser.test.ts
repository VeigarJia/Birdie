import { describe, expect, it } from "vitest";
import fixture from "../fixtures/availability-east-a.json";
import {
  expandSlots,
  extractAntiForgeryToken,
  extractServices,
  makeDisplayNames,
  normalizeDay,
  parsePmDate,
  wallClockTicks,
} from "@/lib/perfectmind/parser";

describe("parsePmDate", () => {
  it("reads /Date(ms)/ as the Melbourne calendar date encoded at UTC midnight", () => {
    expect(parsePmDate("/Date(1795564800000)/")).toBe("2026-11-25");
    expect(parsePmDate("/Date(1795651200000)/")).toBe("2026-11-26");
  });
  it("accepts ISO strings and numbers, rejects junk", () => {
    expect(parsePmDate("2026-05-13T00:00:00")).toBe("2026-05-13");
    expect(parsePmDate(1795564800000)).toBe("2026-11-25");
    expect(parsePmDate("")).toBeNull();
    expect(parsePmDate("nope")).toBeNull();
  });
});

describe("normalizeDay / expandSlots (real response, East A)", () => {
  it("picks the requested day and expands opening hours into 30-minute slots", () => {
    const day = normalizeDay(fixture, "2026-11-25")!;
    expect(day.openingMinutes).toBe(7 * 60);
    expect(day.closingMinutes).toBe(22 * 60);
    const slots = expandSlots(day);
    expect(slots).toHaveLength(30); // 07:00–22:00
    const byStart = new Map(slots.map((s) => [s.startMinutes, s.status]));
    expect(byStart.get(7 * 60)).toBe("available");
    expect(byStart.get(11 * 60 + 30)).toBe("available");
    expect(byStart.get(12 * 60)).toBe("unavailable"); // missing from AvailableSpots => taken
    expect(byStart.get(15 * 60 + 30)).toBe("available");
    expect(byStart.get(18 * 60)).toBe("available");
    expect(byStart.get(21 * 60 + 30)).toBe("unavailable");
  });

  it("returns null when the day is absent (e.g. empty response)", () => {
    expect(normalizeDay({ availabilities: [] }, "2026-11-24")).toBeNull();
    expect(normalizeDay(fixture, "2026-12-01")).toBeNull();
  });

  it("treats disabled spots (outside booking window) as unavailable", () => {
    const data = {
      availabilities: [
        {
          Date: "/Date(1797292800000)/",
          OpeningTime: { TotalMinutes: 420 },
          ClosingTime: { TotalMinutes: 480 },
          BookingGroups: [{ AvailableSpots: [{ Time: { TotalMinutes: 420 }, Duration: { TotalMinutes: 30 }, IsDisabled: true }] }],
        },
      ],
    };
    const day = normalizeDay(data, "2026-12-15")!;
    expect(expandSlots(day).map((s) => s.status)).toEqual(["unavailable", "unavailable"]);
  });

  it("keeps a spot open if any duplicate copy is open", () => {
    const spot = (disabled: boolean) => ({ Time: { TotalMinutes: 420 }, Duration: { TotalMinutes: 30 }, IsDisabled: disabled });
    const data = {
      availabilities: [
        { Date: "2026-11-25T00:00:00", OpeningTime: { TotalMinutes: 420 }, ClosingTime: { TotalMinutes: 450 }, BookingGroups: [{ AvailableSpots: [spot(true), spot(false)] }] },
      ],
    };
    expect(expandSlots(normalizeDay(data, "2026-11-25")!)[0].status).toBe("available");
  });

  it("requires consecutive free slots when the minimum booking is longer than 30 minutes", () => {
    const day = normalizeDay(fixture, "2026-11-25")!;
    const slots = expandSlots(day, 60);
    const byStart = new Map(slots.map((s) => [s.startMinutes, s.status]));
    expect(byStart.get(11 * 60)).toBe("available"); // 11:00 + 11:30 free
    expect(byStart.get(11 * 60 + 30)).toBe("unavailable"); // 12:00 taken
    expect(byStart.get(18 * 60)).toBe("unavailable"); // 18:30 taken
  });
});

describe("wallClockTicks", () => {
  it("matches the Ticks PerfectMind returns for 2026-11-26 07:00", () => {
    expect(wallClockTicks("2026-11-26", 420)).toBe("639312732000000000");
  });
});

describe("makeDisplayNames", () => {
  it("strips venue prefixes when the result is unique", () => {
    expect(makeDisplayNames(["East A", "East B", "West E"])).toEqual(["A", "B", "E"]);
    expect(makeDisplayNames(["East Stadium Court A", "West Stadium Court F"])).toEqual(["A", "F"]);
  });
  it("keeps full names when short names would collide", () => {
    expect(makeDisplayNames(["East A", "West A", "West B"])).toEqual(["East A", "West A", "B"]);
  });
});

describe("landing page extraction", () => {
  const html = `<input name="__RequestVerificationToken" type="hidden" value="tok123" />
    new MainViewModel({ services: [{"ID":"svc","StartsEvery":30,"Durations":[{"Duration":30.0,"FeeType":0,"DurationIDs":["d1","d2"]}]}],
      availabilityUrl: '/x' })`;
  it("reads the token and services", () => {
    expect(extractAntiForgeryToken(html)).toBe("tok123");
    expect(extractServices(html)[0].Durations?.[0].DurationIDs).toEqual(["d1", "d2"]);
  });
  it("returns empty results on unexpected markup", () => {
    expect(extractAntiForgeryToken("<html></html>")).toBeNull();
    expect(extractServices("<html></html>")).toEqual([]);
  });
});
