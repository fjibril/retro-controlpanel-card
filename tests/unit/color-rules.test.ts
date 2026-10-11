import { describe, expect, it } from "vitest";
import { matchColorRule, nextRuleBoundary, ruleMatches } from "../../src/controls/color-rules.js";
import { msUntil, parseTimeTarget } from "../../src/controls/time-format.js";
import type { ColorRule } from "../../src/types.js";

describe("ruleMatches", () => {
  it("uses strict bounds, like HA's numeric conditions", () => {
    expect(ruleMatches({ color: "red", above: 25 }, 25.1)).toBe(true);
    expect(ruleMatches({ color: "red", above: 25 }, 25)).toBe(false);
    expect(ruleMatches({ color: "red", below: 0 }, -0.01)).toBe(true);
    expect(ruleMatches({ color: "red", below: 0 }, 0)).toBe(false);
  });

  it("needs the value inside both bounds when both are set", () => {
    const rule: ColorRule = { color: "amber", above: 0, below: 10 };
    expect(ruleMatches(rule, 5)).toBe(true);
    expect(ruleMatches(rule, 12)).toBe(false);
    expect(ruleMatches(rule, -1)).toBe(false);
  });

  it("matches any value without bounds, but never a missing one", () => {
    expect(ruleMatches({ color: "blue" }, 123)).toBe(true);
    expect(ruleMatches({ color: "blue" }, null)).toBe(false);
    expect(ruleMatches({ color: "blue" }, Number.NaN)).toBe(false);
  });
});

describe("matchColorRule", () => {
  const rules: ColorRule[] = [
    { color: "red", above: 30 },
    { color: "amber", above: 20 },
    { color: "green" },
  ];

  it("returns the first matching rule's colour", () => {
    expect(matchColorRule(rules, () => 35)).toBe("red");
    expect(matchColorRule(rules, () => 25)).toBe("amber");
    expect(matchColorRule(rules, () => 5)).toBe("green");
  });

  it("returns undefined when nothing matches or there are no rules", () => {
    expect(matchColorRule(rules, () => null)).toBeUndefined();
    expect(matchColorRule(undefined, () => 1)).toBeUndefined();
    expect(matchColorRule([], () => 1)).toBeUndefined();
  });

  it("asks for each rule's own value", () => {
    const perEntity: ColorRule[] = [
      { color: "red", entity: "sensor.next", below: 0 },
      { color: "green", below: 0 },
    ];
    // The next one hasn't passed (5), this one has (-3): second rule wins.
    const valueOf = (rule: ColorRule) => (rule.entity ? 5 : -3);
    expect(matchColorRule(perEntity, valueOf)).toBe("green");
  });
});

describe("nextRuleBoundary", () => {
  const minutes = (n: number) => n * 60_000;

  it("is the time until the nearest bound still ahead", () => {
    const rules: ColorRule[] = [{ color: "amber", above: 0, below: 10 }];
    // 25 minutes to go: the 10-minute bound comes first, 15 minutes from now.
    expect(nextRuleBoundary(rules, () => minutes(25))).toBe(minutes(15));
    // 4 minutes to go: only the 0 bound is still ahead.
    expect(nextRuleBoundary(rules, () => minutes(4))).toBe(minutes(4));
  });

  it("is null once every bound is behind, or for rules that aren't time-based", () => {
    const rules: ColorRule[] = [{ color: "red", below: 0 }];
    expect(nextRuleBoundary(rules, () => minutes(-3))).toBeNull();
    expect(nextRuleBoundary(rules, () => null)).toBeNull();
    expect(nextRuleBoundary([{ color: "red" }], () => minutes(5))).toBeNull();
    expect(nextRuleBoundary(undefined, () => minutes(5))).toBeNull();
  });

  it("still reports a bound that is being met right now", () => {
    // Bounds are strict, so at exactly 0 the rule hasn't flipped yet.
    expect(nextRuleBoundary([{ color: "red", below: 0 }], () => 0)).toBe(0);
  });

  it("takes the earliest across rules", () => {
    const rules: ColorRule[] = [
      { color: "red", entity: "sensor.next", below: 0 },
      { color: "green", below: 0 },
    ];
    const msUntilOf = (rule: ColorRule) => (rule.entity ? minutes(90) : minutes(20));
    expect(nextRuleBoundary(rules, msUntilOf)).toBe(minutes(20));
  });
});

describe("msUntil", () => {
  const now = Date.UTC(2026, 9, 11, 18, 0, 0, 300);

  it("is the plain difference for a timestamp", () => {
    const target = parseTimeTarget("2026-10-11T18:38:00+00:00")!;
    expect(msUntil(target, now)).toBe(38 * 60_000 - 300);
    expect(msUntil(target, now + 60 * 60_000)).toBe(-22 * 60_000 - 300);
  });

  it("takes a bare wall time as today in the given zone, to the millisecond", () => {
    const target = parseTimeTarget("18:38")!;
    expect(msUntil(target, now, "UTC")).toBe(38 * 60_000 - 300);
    // 18:00 UTC is 03:00 the next day in Tokyo, so 18:38 "today" there is 15h38m ahead.
    expect(msUntil(target, now, "Asia/Tokyo")).toBe((15 * 60 + 38) * 60_000 - 300);
  });

  it("returns null targets for values that aren't times", () => {
    expect(parseTimeTarget("21.5")).toBeNull();
    expect(parseTimeTarget(undefined)).toBeNull();
  });
});
