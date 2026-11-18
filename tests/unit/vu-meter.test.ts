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

  describe("reversed colour order (green_threshold > yellow_threshold)", () => {
    const colours = (el: RetroVuMeter, segments = 10) =>
      Array.from({ length: segments }, (_, i) => el.colourForSegment(i, segments));

    it("runs red -> yellow -> green from the bottom (0-20 red, 20-70 yellow, 70-100 green)", async () => {
      const el = await build({ green_threshold: 70, yellow_threshold: 20 }, "0");
      toDispose.push(el);
      expect(colours(el)).toEqual([
        "red", "red",                                   // 10%, 20%
        "yellow", "yellow", "yellow", "yellow", "yellow", // 30%..70%
        "green", "green", "green",                      // 80%..100%
      ]);
    });

    it("treats each threshold as an inclusive boundary on the lower band", async () => {
      // 20 segments = 5% each, so the boundaries land exactly on segments.
      const el = await build({ green_threshold: 70, yellow_threshold: 20, segments: 20 }, "0");
      toDispose.push(el);
      expect(el.colourForSegment(3, 20)).toBe("red");     // 20% -> still red
      expect(el.colourForSegment(4, 20)).toBe("yellow");  // 25%
      expect(el.colourForSegment(13, 20)).toBe("yellow"); // 70% -> still yellow
      expect(el.colourForSegment(14, 20)).toBe("green");  // 75%
    });

    it("has no red band when yellow_threshold is 0", async () => {
      const el = await build({ green_threshold: 50, yellow_threshold: 0 }, "0");
      toDispose.push(el);
      expect(colours(el)).toEqual([
        "yellow", "yellow", "yellow", "yellow", "yellow",
        "green", "green", "green", "green", "green",
      ]);
    });

    it("has no green band when green_threshold is 100", async () => {
      const el = await build({ green_threshold: 100, yellow_threshold: 30 }, "0");
      toDispose.push(el);
      expect(colours(el)).toEqual([
        "red", "red", "red",
        "yellow", "yellow", "yellow", "yellow", "yellow", "yellow", "yellow",
      ]);
    });

    it("applies the reversed colours to the rendered segments", async () => {
      const el = await build({ green_threshold: 70, yellow_threshold: 20 }, "50");
      toDispose.push(el);
      const segs = Array.from(el.shadowRoot?.querySelectorAll(".seg") ?? []);
      expect(segs.length).toBe(10);
      expect(segs[0].classList.contains("red")).toBe(true);
      expect(segs[4].classList.contains("yellow")).toBe(true);
      expect(segs[9].classList.contains("green")).toBe(true);
      // 50% of 10 segments lit: the 5 bottom ones (red, red, yellow x3).
      const lit = segs.filter((s) => s.classList.contains("on"));
      expect(lit.length).toBe(5);
      expect(lit.every((s) => !s.classList.contains("green"))).toBe(true);
    });
  });

  describe("normal colour order is kept when reversal isn't explicit", () => {
    it("equal thresholds give green then red with no yellow band", async () => {
      const el = await build({ green_threshold: 50, yellow_threshold: 50 }, "0");
      toDispose.push(el);
      expect(el.colourForSegment(4, 10)).toBe("green"); // 50%
      expect(el.colourForSegment(5, 10)).toBe("red");   // 60%
    });

    it("only green_threshold set above the yellow default (85) stays green -> red", async () => {
      // yellow_threshold falls back to 85, which is below 90 - but it wasn't
      // set explicitly, so this must not flip to the reversed order.
      const el = await build({ green_threshold: 90 }, "0");
      toDispose.push(el);
      for (let i = 0; i < 9; i++) {
        expect(el.colourForSegment(i, 10)).toBe("green");
      }
      expect(el.colourForSegment(9, 10)).toBe("red");
    });

    it("only yellow_threshold set below the green default (60) stays green -> red", async () => {
      const el = await build({ yellow_threshold: 30 }, "0");
      toDispose.push(el);
      expect(el.colourForSegment(0, 10)).toBe("green");
      expect(el.colourForSegment(5, 10)).toBe("green"); // 60% = green default
      expect(el.colourForSegment(6, 10)).toBe("red");
    });

    it("a segment exactly on a threshold stays in the lower band (no float drift)", async () => {
      // 11/20*100 is 55.00000000000001 in floating point; must still count as 55%.
      const el = await build({ green_threshold: 55, yellow_threshold: 85, segments: 20 }, "0");
      toDispose.push(el);
      expect(el.colourForSegment(10, 20)).toBe("green");  // 55%
      expect(el.colourForSegment(11, 20)).toBe("yellow"); // 60%
    });

    it("no thresholds uses the 60/85 defaults", async () => {
      const el = await build({}, "0");
      toDispose.push(el);
      expect(el.colourForSegment(5, 10)).toBe("green");
      expect(el.colourForSegment(6, 10)).toBe("yellow");
      expect(el.colourForSegment(8, 10)).toBe("red");
    });
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
