import { afterEach, describe, expect, it } from "vitest";
import "../../src/controls/retro-vu-meter.js";
import type { RetroVuMeter } from "../../src/controls/retro-vu-meter.js";
import type { VuMeterConfig } from "../../src/types.js";
import { cleanup, makeHass, mount } from "./setup.js";

const baseCfg: VuMeterConfig = {
  type: "vu_meter",
  entity: "sensor.level",
  min: 0,
  max: 100,
  segments: 10,
};

async function build(cfg: Partial<VuMeterConfig>, state: string) {
  const hass = makeHass({ "sensor.level": { state, attributes: {} } });
  return mount<RetroVuMeter>("retro-vu-meter", (n) => {
    n.hass = hass;
    n.config = { ...baseCfg, ...cfg };
  });
}

describe("retro-vu-meter", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => { toDispose.forEach(cleanup); toDispose = []; });

  it("lights zero segments at min", async () => {
    const el = await build({}, "0");
    toDispose.push(el);
    expect(el.calcLitCount(10)).toBe(0);
  });

  it("lights all segments at max", async () => {
    const el = await build({}, "100");
    toDispose.push(el);
    expect(el.calcLitCount(10)).toBe(10);
  });

  it("lights roughly half at the midpoint", async () => {
    const el = await build({}, "50");
    toDispose.push(el);
    expect(el.calcLitCount(10)).toBe(5);
  });

  it("clamps over-range values", async () => {
    const el = await build({}, "9999");
    toDispose.push(el);
    expect(el.calcLitCount(10)).toBe(10);
  });

  it("returns 0 lit for non-numeric state", async () => {
    const el = await build({}, "unavailable");
    toDispose.push(el);
    expect(el.calcLitCount(10)).toBe(0);
  });

  it("respects a custom min/max range", async () => {
    const el = await build({ min: 10, max: 40 }, "25");
    toDispose.push(el);
    // (25-10)/(40-10) = 0.5 => 5 of 10
    expect(el.calcLitCount(10)).toBe(5);
  });

  it("colours segments green/yellow/red based on thresholds (60/85)", async () => {
    const el = await build({ green_threshold: 60, yellow_threshold: 85 }, "0");
    toDispose.push(el);
    // segments 0..5 (60% of 10) green, 6..7 yellow, 8..9 red.
    expect(el.colourForSegment(0, 10)).toBe("green");
    expect(el.colourForSegment(5, 10)).toBe("green");
    expect(el.colourForSegment(6, 10)).toBe("yellow");
    expect(el.colourForSegment(7, 10)).toBe("yellow");
    expect(el.colourForSegment(8, 10)).toBe("red");
    expect(el.colourForSegment(9, 10)).toBe("red");
  });

  it("raising green_threshold expands the green band", async () => {
    // green_threshold = upper edge of green zone, taken as-is (no auto-sort).
    // green up to 90%, yellow up to 100% => segments 0-8 green, segment 9 yellow.
    const wide = await build({ green_threshold: 90, yellow_threshold: 100 }, "0");
    toDispose.push(wide);
    for (let i = 0; i < 9; i++) {
      expect(wide.colourForSegment(i, 10)).toBe("green");
    }
    expect(wide.colourForSegment(9, 10)).toBe("yellow");
  });

  it("yellow_threshold below green_threshold collapses the yellow zone", async () => {
    // Inverted thresholds: yellow zone disappears, segments are green-then-red.
    const inverted = await build({ green_threshold: 70, yellow_threshold: 30 }, "0");
    toDispose.push(inverted);
    expect(inverted.colourForSegment(6, 10)).toBe("green"); // 70% = upper green
    expect(inverted.colourForSegment(7, 10)).toBe("red");   // beyond green & below yellow_top => red
  });

  it("renders the requested number of segment DOM nodes", async () => {
    const el = await build({ segments: 8 }, "50");
    toDispose.push(el);
    const segs = el.shadowRoot?.querySelectorAll(".seg") ?? [];
    expect(segs.length).toBe(8);
  });

  it("hides the value readout unless show_value is set", async () => {
    const el = await build({}, "55");
    toDispose.push(el);
    expect(el.shadowRoot?.querySelector("retro-mini-segments")).toBeNull();
  });

  it("computes value + digit count for the readout", async () => {
    // The readout element is rendered via a Lit conditional child-part, which
    // happy-dom doesn't reliably insert (it works in a real browser - covered
    // by the Playwright suite). Verify the inputs it would receive instead.
    const el = await build({ show_value: true, min: 0, max: 100 }, "55");
    toDispose.push(el);
    const c = el as unknown as { numericState(): number | null; valueDigits(): number };
    expect(c.numericState()).toBe(55);
    expect(c.valueDigits()).toBe(3); // max 100 -> 3 digits
  });
});
