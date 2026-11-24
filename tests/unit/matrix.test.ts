import { describe, expect, it } from "vitest";
import { buildMatrix, clampRange, freshness, openingRange } from "@/lib/matrix";
import type { AvailabilityResponse, FacilityAvailability } from "@/types";

const fac = (id: string, status: "success" | "failed", available: string[] = []): FacilityAvailability => ({
  facility: { id, name: `Court ${id}`, displayName: id },
  status,
  updatedAt: status === "success" ? "2026-11-25T06:00:00.000Z" : null,
  openingTime: status === "success" ? "07:00" : null,
  closingTime: status === "success" ? "22:00" : null,
  slots:
    status === "success"
      ? ["17:00", "17:30", "18:00", "18:30"].map((start) => ({
          start,
          end: "",
          status: available.includes(start) ? ("available" as const) : ("unavailable" as const),
          bookingUrl: available.includes(start) ? `https://unimelb.perfectmind.com/${id}/${start}` : null,
          bookingLinkType: available.includes(start) ? ("exact-slot" as const) : null,
        }))
      : [],
});

const data: AvailabilityResponse = {
  date: "2026-11-25",
  timezone: "Australia/Melbourne",
  slotDuration: 30,
  updatedAt: "2026-11-25T06:00:00.000Z",
  partial: true,
  facilities: [fac("A", "success", ["17:00", "18:00"]), fac("B", "success", ["17:00"]), fac("C", "failed")],
};

describe("buildMatrix", () => {
  it("builds half-open [start, end) rows: 17:00–19:00 gives four rows", () => {
    const rows = buildMatrix(data, "17:00", "19:00", null);
    expect(rows.map((r) => r.time)).toEqual(["17:00", "17:30", "18:00", "18:30"]);
  });

  it("counts Free per row from cell status, and marks rows with unknown courts incomplete", () => {
    const rows = buildMatrix(data, "17:00", "19:00", null);
    expect(rows.map((r) => r.free)).toEqual([2, 0, 1, 0]);
    expect(rows.every((r) => r.incomplete)).toBe(true);
    expect(rows[0].cells.map((c) => c.status)).toEqual(["available", "available", "unknown"]);
  });

  it("never shows a failed court as unavailable", () => {
    const rows = buildMatrix(data, "17:00", "17:30", null);
    expect(rows[0].cells[2]).toMatchObject({ status: "unknown", bookingUrl: null });
  });

  it("marks ended slots as past, and started slots past unless still offered", () => {
    // 18:10 Melbourne: 17:00 and 17:30 have ended; 18:00 started but A still offers it.
    const rows = buildMatrix(data, "17:00", "19:00", 18 * 60 + 10);
    expect(rows[0].cells[0].status).toBe("past");
    expect(rows[0].free).toBe(0);
    expect(rows[2].cells[0].status).toBe("available");
    expect(rows[2].cells[1].status).toBe("past");
    expect(rows[3].cells[0].status).toBe("unavailable");
  });

  it("treats slots missing from a successful court as unavailable", () => {
    const rows = buildMatrix(data, "07:00", "07:30", null);
    expect(rows[0].cells[0].status).toBe("unavailable");
  });
});

describe("clampRange / openingRange", () => {
  it("defaults to full opening hours", () => {
    expect(clampRange(undefined, undefined, "07:00", "22:00")).toEqual({ startTime: "07:00", endTime: "22:00" });
  });
  it("keeps saved ranges inside opening hours and non-empty", () => {
    expect(clampRange("06:00", "23:00", "07:00", "22:00")).toEqual({ startTime: "07:00", endTime: "22:00" });
    expect(clampRange("21:30", "21:30", "07:00", "22:00")).toEqual({ startTime: "21:30", endTime: "22:00" });
    expect(clampRange("17:10", "19:00", "07:00", "22:00")).toEqual({ startTime: "17:00", endTime: "19:00" });
  });
  it("falls back to verified hours with no data", () => {
    expect(openingRange(null)).toEqual({ open: "07:00", close: "22:00" });
  });
});

describe("freshness", () => {
  const t0 = Date.parse("2026-11-25T06:00:00.000Z");
  it("is fresh ≤ 2 min, stale ≤ 10 min, expired after or when offline", () => {
    expect(freshness("2026-11-25T06:00:00.000Z", t0 + 119_000, true)).toBe("fresh");
    expect(freshness("2026-11-25T06:00:00.000Z", t0 + 300_000, true)).toBe("stale");
    expect(freshness("2026-11-25T06:00:00.000Z", t0 + 601_000, true)).toBe("expired");
    expect(freshness("2026-11-25T06:00:00.000Z", t0, false)).toBe("expired");
  });
});
