/**
 * Pure helpers for the seven-segment time modes: parsing entity states into
 * times, turning times into display tokens, and working out when the display
 * next changes so it can tick locally without polling.
 */

export interface WallTime {
  h: number;
  m: number;
  s: number;
}

/** True for the seven-segment display modes that show a time instead of a number. */
export function isTimeMode(mode: string | undefined): mode is "time" | "countdown" {
  return mode === "time" || mode === "countdown";
}

// Strict shape check first: Date.parse is lenient and would happily turn a
// plain number state like "5" into a date.
const ISO_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const PLAIN_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/** Hours above this don't fit two digit slots; the countdown shows dashes. */
const MAX_HOURS = 99;

/** Ticks land just past each boundary so the new value is already current. */
const FLIP_MARGIN_MS = 25;

/** Epoch ms for an ISO-style datetime string (HA timestamp sensors), else null. */
export function parseIsoInstant(v: unknown): number | null {
  if (typeof v !== "string" || !ISO_RE.test(v)) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

/** A bare "HH:MM" or "HH:MM:SS" wall time (e.g. sensor.time), else null. */
export function parsePlainTime(v: unknown): WallTime | null {
  if (typeof v !== "string") return null;
  const m = PLAIN_RE.exec(v);
  if (!m) return null;
  const t = { h: Number(m[1]), m: Number(m[2]), s: Number(m[3] ?? 0) };
  return t.h < 24 && t.m < 60 && t.s < 60 ? t : null;
}

export function secondsOfDay(t: WallTime): number {
  return t.h * 3600 + t.m * 60 + t.s;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string | undefined): Intl.DateTimeFormat {
  const key = timeZone ?? "";
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      });
    } catch {
      // Unknown IANA zone name: fall back to the browser's zone.
      f = formatterFor(undefined);
    }
    formatters.set(key, f);
  }
  return f;
}

/** Wall-clock time of an instant in `timeZone` (undefined = browser zone). */
export function wallTimeAt(ms: number, timeZone?: string): WallTime {
  const parts = formatterFor(timeZone).formatToParts(ms);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Some engines report midnight as hour 24 even with h23.
  return { h: get("hour") % 24, m: get("minute"), s: get("second") };
}

const two = (n: number): string[] => [...String(n).padStart(2, "0")];

function hmsTokens(h: number, m: number, s: number, withSeconds: boolean): string[] {
  const out = [...two(h), ":", ...two(m)];
  if (withSeconds) out.push(":", ...two(s));
  return out;
}

function dashTokens(withSeconds: boolean): string[] {
  const out = ["-", "-", ":", "-", "-"];
  if (withSeconds) out.push(":", "-", "-");
  return out;
}

/** "HH:MM(:SS)" tokens for a wall time; dashes when there is no usable time. */
export function clockTokens(t: WallTime | null, withSeconds: boolean): string[] {
  return t ? hmsTokens(t.h, t.m, t.s, withSeconds) : dashTokens(withSeconds);
}

/**
 * Countdown tokens for `deltaSec` = target - now. A leading sign slot keeps
 * the width steady: blank while the target is ahead, "-" once it has passed.
 * Dashes when there is no target or the span exceeds 99 hours.
 */
export function countdownTokens(deltaSec: number | null, withSeconds: boolean): string[] {
  if (deltaSec === null || !Number.isFinite(deltaSec)) {
    return [" ", ...dashTokens(withSeconds)];
  }
  const abs = Math.floor(Math.abs(deltaSec));
  const h = Math.floor(abs / 3600);
  if (h > MAX_HOURS) return [" ", ...dashTokens(withSeconds)];
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  return [deltaSec < 0 ? "-" : " ", ...hmsTokens(h, m, s, withSeconds)];
}

/**
 * Milliseconds until a display that changes every `period` ms, in phase with
 * `anchor` (epoch ms), shows its next value. Anchor 0 = wall-clock boundaries;
 * a countdown anchors on its target so it flips exactly as each unit elapses.
 */
export function nextFlipDelay(now: number, anchor: number, period: number): number {
  const phase = (((now - anchor) % period) + period) % period;
  return period - phase + FLIP_MARGIN_MS;
}
