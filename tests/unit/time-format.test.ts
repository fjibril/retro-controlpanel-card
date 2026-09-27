import { describe, expect, it } from "vitest";
import {
  clockTokens,
  countdownTokens,
  isTimeMode,
  nextFlipDelay,
  parseIsoInstant,
  parsePlainTime,
  wallTimeAt,
} from "../../src/controls/time-format.js";

describe("parseIsoInstant", () => {
  it("parses HA timestamp states with an offset", () => {
    expect(parseIsoInstant("2026-09-26T03:39:00+00:00")).toBe(Date.UTC(2026, 8, 26, 3, 39));
  });

  it("parses a space-separated datetime", () => {
    expect(parseIsoInstant("2026-09-26 03:39:00Z")).toBe(Date.UTC(2026, 8, 26, 3, 39));
  });

  it("rejects numbers, bare times and non-strings that Date.parse would accept", () => {
    expect(parseIsoInstant("5")).toBeNull();
    expect(parseIsoInstant("21.5")).toBeNull();
    expect(parseIsoInstant("13:12")).toBeNull();
    expect(parseIsoInstant("unavailable")).toBeNull();
    expect(parseIsoInstant(1_700_000_000_000)).toBeNull();
  });
});

describe("parsePlainTime", () => {
  it("parses HH:MM and HH:MM:SS", () => {
    expect(parsePlainTime("13:12")).toEqual({ h: 13, m: 12, s: 0 });
    expect(parsePlainTime("5:39:07")).toEqual({ h: 5, m: 39, s: 7 });
  });

  it("rejects out-of-range and malformed values", () => {
    expect(parsePlainTime("24:00")).toBeNull();
    expect(parsePlainTime("12:60")).toBeNull();
    expect(parsePlainTime("1312")).toBeNull();
    expect(parsePlainTime("2026-09-26T13:12:00Z")).toBeNull();
  });
});

describe("wallTimeAt", () => {
  const ms = Date.UTC(2026, 8, 26, 3, 39, 5);

  it("converts into the requested time zone", () => {
    expect(wallTimeAt(ms, "UTC")).toEqual({ h: 3, m: 39, s: 5 });
    expect(wallTimeAt(ms, "Asia/Tokyo")).toEqual({ h: 12, m: 39, s: 5 });
  });

  it("reports midnight as hour 0", () => {
    expect(wallTimeAt(Date.UTC(2026, 8, 26, 0, 0, 0), "UTC")).toEqual({ h: 0, m: 0, s: 0 });
  });

  it("falls back to the browser zone for an unknown zone name", () => {
    expect(wallTimeAt(ms, "Not/AZone")).toEqual(wallTimeAt(ms));
  });
});

describe("clockTokens", () => {
  it("renders zero-padded HH:MM", () => {
    expect(clockTokens({ h: 5, m: 39, s: 7 }, false)).toEqual(["0", "5", ":", "3", "9"]);
  });

  it("adds a seconds slot on request", () => {
    expect(clockTokens({ h: 5, m: 39, s: 7 }, true)).toEqual(["0", "5", ":", "3", "9", ":", "0", "7"]);
  });

  it("renders dashes without a time", () => {
    expect(clockTokens(null, false)).toEqual(["-", "-", ":", "-", "-"]);
    expect(clockTokens(null, true)).toEqual(["-", "-", ":", "-", "-", ":", "-", "-"]);
  });
});

describe("countdownTokens", () => {
  const span = 2 * 3600 + 14 * 60 + 22;

  it("has no sign while the target is still ahead", () => {
    expect(countdownTokens(span, false)).toEqual([" ", "0", "2", ":", "1", "4"]);
    expect(countdownTokens(span, true)).toEqual([" ", "0", "2", ":", "1", "4", ":", "2", "2"]);
  });

  it("shows a minus once the target has passed", () => {
    expect(countdownTokens(-span, false)).toEqual(["-", "0", "2", ":", "1", "4"]);
  });

  it("truncates partial units rather than rounding up", () => {
    expect(countdownTokens(59.9, false)).toEqual([" ", "0", "0", ":", "0", "0"]);
    expect(countdownTokens(-0.4, true)).toEqual(["-", "0", "0", ":", "0", "0", ":", "0", "0"]);
  });

  it("renders dashes past 99:59:59 and without a target", () => {
    expect(countdownTokens(100 * 3600, false)).toEqual([" ", "-", "-", ":", "-", "-"]);
    expect(countdownTokens(99 * 3600 + 59 * 60 + 59, true)).toEqual([" ", "9", "9", ":", "5", "9", ":", "5", "9"]);
    expect(countdownTokens(null, true)).toEqual([" ", "-", "-", ":", "-", "-", ":", "-", "-"]);
  });
});

describe("nextFlipDelay", () => {
  it("waits for the next wall-clock boundary (anchor 0)", () => {
    expect(nextFlipDelay(10_400, 0, 1000)).toBe(600 + 25);
    expect(nextFlipDelay(Date.UTC(2026, 8, 26, 14, 3, 7), 0, 60_000)).toBe(53_000 + 25);
  });

  it("aligns a countdown to its target, not to the wall clock", () => {
    const target = Date.UTC(2026, 8, 26, 13, 12, 37);
    const now = Date.UTC(2026, 8, 26, 11, 12, 30);
    // Minutes remaining next change when the remainder crosses :37.
    expect(nextFlipDelay(now, target, 60_000)).toBe(7_000 + 25);
  });

  it("waits a whole period when sitting exactly on a boundary", () => {
    expect(nextFlipDelay(60_000, 0, 60_000)).toBe(60_000 + 25);
  });
});

describe("isTimeMode", () => {
  it("is true only for the time modes", () => {
    expect(isTimeMode("time")).toBe(true);
    expect(isTimeMode("countdown")).toBe(true);
    expect(isTimeMode("number")).toBe(false);
    expect(isTimeMode(undefined)).toBe(false);
  });
});
