import type { ColorRule, GlowColor } from "../types.js";

/**
 * Conditional colours for a display. Rules are tried in order and the first
 * one whose bounds contain its value decides the colour. A value is a plain
 * number, or for a timestamp the minutes until it (negative once passed), so
 * `below: 0` on a time reads "has passed".
 */

const MS_PER_MINUTE = 60_000;

/** True when `value` lies strictly inside the rule's bounds. No value, no match. */
export function ruleMatches(rule: ColorRule, value: number | null): boolean {
  if (value === null || !Number.isFinite(value)) return false;
  if (typeof rule.above === "number" && !(value > rule.above)) return false;
  if (typeof rule.below === "number" && !(value < rule.below)) return false;
  return true;
}

/** Colour of the first matching rule, or undefined when none match. */
export function matchColorRule(
  rules: readonly ColorRule[] | undefined,
  valueOf: (rule: ColorRule) => number | null,
): GlowColor | undefined {
  if (!Array.isArray(rules)) return undefined;
  for (const rule of rules as readonly ColorRule[]) {
    if (rule && ruleMatches(rule, valueOf(rule))) return rule.color;
  }
  return undefined;
}

/**
 * Milliseconds until a time-based rule next reaches one of its bounds, or
 * null when no rule is waiting on the clock. `msUntilOf` gives the ms until a
 * rule's timestamp, or null for rules that test a plain number (those change
 * with the entity's state, not with time).
 */
export function nextRuleBoundary(
  rules: readonly ColorRule[] | undefined,
  msUntilOf: (rule: ColorRule) => number | null,
): number | null {
  if (!Array.isArray(rules)) return null;
  let next: number | null = null;
  for (const rule of rules as readonly ColorRule[]) {
    if (!rule) continue;
    const ms = msUntilOf(rule);
    if (ms === null) continue;
    for (const bound of [rule.above, rule.below]) {
      if (typeof bound !== "number") continue;
      // The value counts down, so it meets the bound this far from now. Zero
      // counts too: bounds are strict, the outcome flips just after.
      const delay = ms - bound * MS_PER_MINUTE;
      if (delay >= 0 && (next === null || delay < next)) next = delay;
    }
  }
  return next;
}
