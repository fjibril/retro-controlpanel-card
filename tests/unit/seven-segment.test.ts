import { afterEach, describe, expect, it, vi } from "vitest";
import "../../src/controls/retro-seven-segment.js";
import type { RetroSevenSegment } from "../../src/controls/retro-seven-segment.js";
import type { SevenSegmentConfig } from "../../src/types.js";
import { clockTokens, wallTimeAt } from "../../src/controls/time-format.js";
import { GLOW_PALETTE } from "../../src/controls/glow-palette.js";
import { cleanup, makeHass, mount } from "./setup.js";

const baseCfg: SevenSegmentConfig = {
  type: "seven_segment",
  entity: "sensor.temp",
  num_digits: 4,
};

async function build(
  cfg: Partial<SevenSegmentConfig>,
  value: string,
  attributes: Record<string, unknown> = {},
) {
  const hass = makeHass({ "sensor.temp": { state: value, attributes } });
  const el = await mount<RetroSevenSegment>("retro-seven-segment", (n) => {
    n.hass = hass;
    n.config = { ...baseCfg, ...cfg };
  });
  return { el, hass };
}

describe("retro-seven-segment.formatTokens", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => {
    toDispose.forEach(cleanup);
    toDispose = [];
  });

  it("pads with spaces when leading_zeros is off", async () => {
    const { el } = await build({ leading_zeros: false }, "12");
    toDispose.push(el);
    expect(el.formatTokens(4)).toEqual([" ", " ", "1", "2"]);
  });

  it("pads with zeros when leading_zeros is on", async () => {
    const { el } = await build({ leading_zeros: true }, "12");
    toDispose.push(el);
    expect(el.formatTokens(4)).toEqual(["0", "0", "1", "2"]);
  });

  it("renders a decimal point as its own token between digits", async () => {
    const { el } = await build({ maximum_fraction_digits: 2, leading_zeros: false }, "12.34");
    toDispose.push(el);
    expect(el.formatTokens(4)).toEqual(["1", "2", ".", "3", "4"]);
  });

  it("truncates fraction digits to maximum_fraction_digits", async () => {
    const { el } = await build({ maximum_fraction_digits: 1, leading_zeros: false }, "12.567");
    toDispose.push(el);
    // 12.567 rounded to 1 fraction digit = 12.6
    expect(el.formatTokens(4)).toEqual([" ", "1", "2", ".", "6"]);
  });

  it("renders negative numbers with a leading minus", async () => {
    const { el } = await build({ leading_zeros: false }, "-7");
    toDispose.push(el);
    expect(el.formatTokens(4)).toEqual([" ", " ", "-", "7"]);
  });

  it("returns dashes when overflow", async () => {
    const { el } = await build({ leading_zeros: false }, "12345");
    toDispose.push(el);
    expect(el.formatTokens(4)).toEqual(["-", "-", "-", "-"]);
  });

  it("returns dashes for unavailable entity", async () => {
    const { el } = await build({}, "unavailable");
    toDispose.push(el);
    expect(el.formatTokens(4)).toEqual(["-", "-", "-", "-"]);
  });

  it("spells out a text state in segment letters", async () => {
    const heat = await build({}, "heat");
    const off = await build({}, "off");
    toDispose.push(heat.el, off.el);
    expect(heat.el.formatTokens(4)).toEqual(["h", "e", "a", "t"]);
    expect(off.el.formatTokens(4)).toEqual([" ", "o", "f", "f"]);
  });

  it("spells out a text attribute such as a climate's hvac_action", async () => {
    const { el } = await build({ attribute: "hvac_action" }, "21", { hvac_action: "heating" });
    toDispose.push(el);
    expect(el.formatTokens(4)).toEqual(["h", "e", "a", "t"]);
  });

  it("still shows dashes for unknown and for a missing attribute", async () => {
    const unknown = await build({}, "unknown");
    const missing = await build({ attribute: "hvac_action" }, "21");
    toDispose.push(unknown.el, missing.el);
    expect(unknown.el.formatTokens(4)).toEqual(["-", "-", "-", "-"]);
    expect(missing.el.formatTokens(4)).toEqual(["-", "-", "-", "-"]);
  });

  it("compact mode shows only the window, without the label row", async () => {
    const hass = makeHass({ "sensor.temp": { state: "21" } });
    const el = await mount<RetroSevenSegment>("retro-seven-segment", (n) => {
      n.compact = true;
      n.hass = hass;
      n.config = { ...baseCfg, label: "Living" };
    });
    toDispose.push(el);
    expect(el.hasAttribute("compact")).toBe(true);
    expect(el.shadowRoot?.querySelector(".display")).not.toBeNull();
    expect(el.shadowRoot?.querySelector(".label-row")).toBeNull();
  });

  it("renders the unit suffix when provided", async () => {
    const { el } = await build({ unit: "°C" }, "21");
    toDispose.push(el);
    const unit = el.shadowRoot?.querySelector(".unit");
    expect(unit?.textContent).toBe("°C");
  });

  it("pulls the unit from the entity when not configured", async () => {
    const { el } = await build({}, "21", { unit_of_measurement: "kWh" });
    toDispose.push(el);
    const unit = el.shadowRoot?.querySelector(".unit");
    expect(unit?.textContent).toBe("kWh");
  });

  it("a configured unit overrides the entity unit", async () => {
    const { el } = await build({ unit: "°F" }, "21", { unit_of_measurement: "°C" });
    toDispose.push(el);
    const unit = el.shadowRoot?.querySelector(".unit");
    expect(unit?.textContent).toBe("°F");
  });

  it("an explicit empty unit hides the unit even if the entity has one", async () => {
    const { el } = await build({ unit: "" }, "21", { unit_of_measurement: "°C" });
    toDispose.push(el);
    expect(el.shadowRoot?.querySelector(".unit")).toBeNull();
  });

  it("a whitespace-only unit is trimmed away (no stray chip)", async () => {
    const { el } = await build({ unit: " " }, "21", { unit_of_measurement: "°C" });
    toDispose.push(el);
    expect(el.shadowRoot?.querySelector(".unit")).toBeNull();
  });

});

describe("retro-seven-segment.resolvedLabel", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => {
    toDispose.forEach(cleanup);
    toDispose = [];
  });

  const labelOf = (el: RetroSevenSegment) =>
    (el as unknown as { resolvedLabel(): string }).resolvedLabel();

  it("uses a configured label verbatim", async () => {
    const { el } = await build({ label: "Boiler" }, "21");
    toDispose.push(el);
    expect(labelOf(el)).toBe("Boiler");
  });

  it("falls back to friendly_name when no label is set", async () => {
    const { el } = await build({}, "21", { friendly_name: "Living Room" });
    toDispose.push(el);
    expect(labelOf(el)).toBe("Living Room");
  });

  it("falls back to the entity id when there is no friendly_name", async () => {
    const { el } = await build({}, "21");
    toDispose.push(el);
    expect(labelOf(el)).toBe("sensor.temp");
  });

  it("a single space hides the label (same convention as the unit)", async () => {
    const { el } = await build({ label: " " }, "21", { friendly_name: "Living Room" });
    toDispose.push(el);
    expect(labelOf(el)).toBe("");
  });
});

/**
 * Time-mode display whose hass reports a server time zone the profile has
 * opted into, so results don't depend on the test machine's zone.
 */
async function buildTime(cfg: Partial<SevenSegmentConfig>, state?: string, timeZone = "UTC") {
  const hass = makeHass(state === undefined ? {} : { "sensor.event": { state } });
  Object.assign(hass, { config: { time_zone: timeZone }, locale: { time_zone: "server" } });
  const el = await mount<RetroSevenSegment>("retro-seven-segment", (n) => {
    n.hass = hass;
    n.config = {
      type: "seven_segment",
      ...(state === undefined ? {} : { entity: "sensor.event" }),
      ...cfg,
    };
  });
  return { el, hass };
}

describe("retro-seven-segment time modes", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => {
    toDispose.forEach(cleanup);
    toDispose = [];
    vi.useRealTimers();
  });

  const fakeClock = (iso: string) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date(iso));
  };
  const renderedAt = (el: RetroSevenSegment) =>
    (el as unknown as { renderedAt: number }).renderedAt;

  it("time mode shows an ISO timestamp as HH:MM in the display zone", async () => {
    const { el } = await buildTime({ display_mode: "time" }, "2026-09-26T03:39:00+00:00", "Asia/Tokyo");
    toDispose.push(el);
    expect(el.displayTokens()).toEqual(["1", "2", ":", "3", "9"]);
  });

  it("time mode uses the browser zone unless the profile picks the server zone", async () => {
    const state = "2026-09-26T03:39:00+00:00";
    const hass = makeHass({ "sensor.event": { state } });
    Object.assign(hass, { config: { time_zone: "Asia/Tokyo" }, locale: { time_zone: "local" } });
    const el = await mount<RetroSevenSegment>("retro-seven-segment", (n) => {
      n.hass = hass;
      n.config = { type: "seven_segment", entity: "sensor.event", display_mode: "time" };
    });
    toDispose.push(el);
    expect(el.displayTokens()).toEqual(clockTokens(wallTimeAt(Date.parse(state)), false));
  });

  it("time mode accepts a plain HH:MM state such as sensor.time", async () => {
    const { el } = await buildTime({ display_mode: "time", show_seconds: true }, "14:03");
    toDispose.push(el);
    expect(el.displayTokens()).toEqual(["1", "4", ":", "0", "3", ":", "0", "0"]);
  });

  it("time mode shows dashes for a state that isn't a time", async () => {
    const { el } = await buildTime({ display_mode: "time" }, "21.5");
    toDispose.push(el);
    expect(el.displayTokens()).toEqual(["-", "-", ":", "-", "-"]);
  });

  it("renders a colon cell between each digit pair", async () => {
    const { el } = await buildTime({ display_mode: "time", show_seconds: true }, "14:03:09");
    toDispose.push(el);
    expect(el.shadowRoot?.querySelectorAll(".display .colon").length).toBe(2);
    expect(el.shadowRoot?.querySelectorAll(".display .digit").length).toBe(6);
  });

  it("time mode without an entity is a clock of the current time", async () => {
    fakeClock("2026-09-26T14:03:07Z");
    const { el } = await buildTime({ display_mode: "time", show_seconds: true });
    toDispose.push(el);
    expect(el.displayTokens()).toEqual(["1", "4", ":", "0", "3", ":", "0", "7"]);
  });

  it("countdown shows the time left until a future timestamp, unsigned", async () => {
    fakeClock("2026-09-26T11:12:30Z");
    const { el } = await buildTime({ display_mode: "countdown" }, "2026-09-26T13:12:00+00:00");
    toDispose.push(el);
    expect(el.displayTokens()).toEqual([" ", "0", "1", ":", "5", "9"]);
    const withSeconds = await buildTime(
      { display_mode: "countdown", show_seconds: true },
      "2026-09-26T13:12:00+00:00",
    );
    toDispose.push(withSeconds.el);
    expect(withSeconds.el.displayTokens()).toEqual([" ", "0", "1", ":", "5", "9", ":", "3", "0"]);
  });

  it("countdown shows '-' and the time since once the timestamp has passed", async () => {
    fakeClock("2026-09-26T16:45:00Z");
    const { el } = await buildTime({ display_mode: "countdown" }, "2026-09-26T11:12:00+00:00");
    toDispose.push(el);
    expect(el.displayTokens()).toEqual(["-", "0", "5", ":", "3", "3"]);
  });

  it("countdown without an entity shows dashes", async () => {
    const { el } = await buildTime({ display_mode: "countdown" });
    toDispose.push(el);
    expect(el.displayTokens()).toEqual([" ", "-", "-", ":", "-", "-"]);
  });

  it("schedules no timer for numbers or a fixed timestamp", async () => {
    fakeClock("2026-09-26T14:03:07Z");
    const before = vi.getTimerCount();
    const { el: num } = await build({}, "21");
    const { el: fixed } = await buildTime({ display_mode: "time" }, "2026-09-26T03:39:00+00:00");
    toDispose.push(num, fixed);
    expect(vi.getTimerCount()).toBe(before);
  });

  it("a clock without seconds re-renders once a minute, not every second", async () => {
    fakeClock("2026-09-26T14:03:07Z");
    const before = vi.getTimerCount();
    const { el, hass } = await buildTime({ display_mode: "time" });
    toDispose.push(el);
    expect(vi.getTimerCount() - before).toBe(1);
    const first = renderedAt(el);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(renderedAt(el)).toBe(first);

    await vi.advanceTimersByTimeAsync(23_100); // just past 14:04:00
    await el.updateComplete;
    expect(renderedAt(el)).toBeGreaterThan(first);
    expect(el.displayTokens()).toEqual(["1", "4", ":", "0", "4"]);
    expect(vi.getTimerCount() - before).toBe(1);
    expect(hass.callService).not.toHaveBeenCalled();
  });

  it("a clock with seconds ticks once per second", async () => {
    fakeClock("2026-09-26T14:03:07Z");
    const { el } = await buildTime({ display_mode: "time", show_seconds: true });
    toDispose.push(el);
    const first = renderedAt(el);
    await vi.advanceTimersByTimeAsync(1_030);
    await el.updateComplete;
    expect(renderedAt(el) - first).toBeGreaterThanOrEqual(1_000);
    expect(el.displayTokens()).toEqual(["1", "4", ":", "0", "3", ":", "0", "8"]);
  });

  it("stops ticking when removed from the page", async () => {
    fakeClock("2026-09-26T11:12:30Z");
    const before = vi.getTimerCount();
    const { el } = await buildTime(
      { display_mode: "countdown", show_seconds: true },
      "2026-09-26T13:12:00+00:00",
    );
    expect(vi.getTimerCount() - before).toBe(1);
    cleanup(el);
    expect(vi.getTimerCount()).toBe(before);
  });
});

describe("retro-seven-segment colour rules", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => {
    toDispose.forEach(cleanup);
    toDispose = [];
    vi.useRealTimers();
  });

  const fakeClock = (iso: string) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date(iso));
  };
  const segmentColor = (el: RetroSevenSegment) => el.style.getPropertyValue("--retro-segment-on");

  // Five start times from one day's timetable, each display naming its
  // successor so it can tell "current" (started, next one hasn't) from "over"
  // (next one started too).
  const PERIODS: Record<string, string> = {
    "sensor.period_1": "2026-10-11T06:04:00+00:00",
    "sensor.period_2": "2026-10-11T13:08:00+00:00",
    "sensor.period_3": "2026-10-11T16:00:00+00:00",
    "sensor.period_4": "2026-10-11T18:38:00+00:00",
    "sensor.period_5": "2026-10-11T20:11:00+00:00",
  };
  const ORDER = Object.keys(PERIODS);

  async function buildPeriod(entity: string, mode: "time" | "countdown") {
    const hass = makeHass(
      Object.fromEntries(Object.entries(PERIODS).map(([id, state]) => [id, { state }])),
    );
    Object.assign(hass, { config: { time_zone: "UTC" }, locale: { time_zone: "server" } });
    const next = ORDER[ORDER.indexOf(entity) + 1];
    const el = await mount<RetroSevenSegment>("retro-seven-segment", (n) => {
      n.hass = hass;
      n.config = {
        type: "seven_segment",
        entity,
        display_mode: mode,
        color: "blue",
        color_rules: [
          ...(next ? [{ color: "red" as const, entity: next, below: 0 }] : []),
          { color: "green" as const, below: 0 },
        ],
      };
    });
    toDispose.push(el);
    return el;
  }

  it("number mode: colours by the displayed value, else the configured colour", async () => {
    const rules = { color: "green" as const, color_rules: [{ color: "red" as const, above: 25 }] };
    const hot = await build(rules, "30");
    const mild = await build(rules, "20");
    toDispose.push(hot.el, mild.el);
    expect(hot.el.effectiveColor()).toBe("red");
    expect(segmentColor(hot.el)).toBe(GLOW_PALETTE.red.on);
    expect(mild.el.effectiveColor()).toBe("green");
    expect(segmentColor(mild.el)).toBe(GLOW_PALETTE.green.on);
  });

  it("a rule can test another entity's value", async () => {
    const hass = makeHass({ "sensor.temp": { state: "21" }, "sensor.alarm_level": { state: "3" } });
    const el = await mount<RetroSevenSegment>("retro-seven-segment", (n) => {
      n.hass = hass;
      n.config = { ...baseCfg, color_rules: [{ color: "red", entity: "sensor.alarm_level", above: 2 }] };
    });
    toDispose.push(el);
    expect(el.effectiveColor()).toBe("red");
  });

  it("no rule matching and no colour set leaves the theme colour", async () => {
    const { el } = await build({ color_rules: [{ color: "red", above: 25 }] }, "20");
    toDispose.push(el);
    expect(el.effectiveColor()).toBeUndefined();
    expect(segmentColor(el)).toBe("");
  });

  for (const mode of ["time", "countdown"] as const) {
    it(`${mode} mode: past periods red, the current one green, upcoming blue`, async () => {
      // Period 4 started 37 minutes ago, period 5 starts in 55 minutes.
      fakeClock("2026-10-11T19:15:30Z");
      const colors: Record<string, string | undefined> = {};
      for (const entity of ORDER) colors[entity] = (await buildPeriod(entity, mode)).effectiveColor();
      expect(colors).toEqual({
        "sensor.period_1": "red",
        "sensor.period_2": "red",
        "sensor.period_3": "red",
        "sensor.period_4": "green",
        "sensor.period_5": "blue",
      });
    });
  }

  it("a fixed time display wakes exactly when a rule's time is reached, and recolours", async () => {
    fakeClock("2026-10-11T18:30:00Z"); // 8 minutes before period 4
    const before = vi.getTimerCount();
    const el = await buildPeriod("sensor.period_4", "time");
    expect(segmentColor(el)).toBe(GLOW_PALETTE.blue.on);
    expect(vi.getTimerCount() - before).toBe(1);

    // Nothing happens while it is still upcoming...
    await vi.advanceTimersByTimeAsync(7 * 60_000);
    await el.updateComplete;
    expect(segmentColor(el)).toBe(GLOW_PALETTE.blue.on);

    // ...it turns green as period 4 starts...
    await vi.advanceTimersByTimeAsync(60_000 + 100);
    await el.updateComplete;
    expect(segmentColor(el)).toBe(GLOW_PALETTE.green.on);

    // ...and red once period 5 (the entity its first rule watches) has started,
    // 93 minutes later - longer than a single timer, so it re-plans on the way.
    await vi.advanceTimersByTimeAsync(93 * 60_000);
    await el.updateComplete;
    expect(segmentColor(el)).toBe(GLOW_PALETTE.red.on);
    // Every bound is behind it now: no timer left running.
    expect(vi.getTimerCount()).toBe(before);
  });

  it("rules on plain numbers schedule no timer", async () => {
    fakeClock("2026-10-11T18:30:00Z");
    const before = vi.getTimerCount();
    const { el } = await build({ color_rules: [{ color: "red", above: 25 }] }, "30");
    toDispose.push(el);
    expect(vi.getTimerCount()).toBe(before);
  });

  it("an unknown colour name falls back to the theme colour instead of failing", async () => {
    const { el } = await build({ color_rules: [{ color: "purple" as never }] }, "30");
    toDispose.push(el);
    expect(segmentColor(el)).toBe("");
  });
});
