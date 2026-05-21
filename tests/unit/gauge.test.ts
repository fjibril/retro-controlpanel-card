import { afterEach, describe, expect, it } from "vitest";
import "../../src/controls/retro-gauge.js";
import type { RetroGauge } from "../../src/controls/retro-gauge.js";
import type { GaugeConfig } from "../../src/types.js";
import { cleanup, makeHass, mount } from "./setup.js";

const baseCfg: GaugeConfig = {
  type: "gauge",
  entity: "sensor.speed",
  min: 0,
  max: 100,
};

async function build(cfg: Partial<GaugeConfig>, state: string) {
  const hass = makeHass({ "sensor.speed": { state, attributes: {} } });
  return mount<RetroGauge>("retro-gauge", (n) => {
    n.hass = hass;
    n.config = { ...baseCfg, ...cfg };
  });
}

describe("retro-gauge.needleAngle", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => { toDispose.forEach(cleanup); toDispose = []; });

  it("points fully left (-90deg) at min", async () => {
    const el = await build({}, "0");
    toDispose.push(el);
    expect(el.needleAngle()).toBe(-90);
  });

  it("points fully right (+90deg) at max", async () => {
    const el = await build({}, "100");
    toDispose.push(el);
    expect(el.needleAngle()).toBe(90);
  });

  it("points straight up (0deg) at midpoint", async () => {
    const el = await build({}, "50");
    toDispose.push(el);
    expect(el.needleAngle()).toBe(0);
  });

  it("clamps values above max to +90deg", async () => {
    const el = await build({}, "500");
    toDispose.push(el);
    expect(el.needleAngle()).toBe(90);
  });

  it("clamps values below min to -90deg", async () => {
    const el = await build({ min: 10 }, "-50");
    toDispose.push(el);
    expect(el.needleAngle()).toBe(-90);
  });

  it("returns undefined for unavailable state", async () => {
    const el = await build({}, "unavailable");
    toDispose.push(el);
    expect(el.needleAngle()).toBeUndefined();
  });

  it("produces the expected number of major ticks with labels", async () => {
    const el = await build({ major_ticks: 5, minor_ticks: 4 }, "50");
    toDispose.push(el);
    // happy-dom's HTML parser doesn't switch to SVG namespace for <svg>
    // children created by Lit, so SVG-DOM assertions are not reliable here -
    // call the tick-building math directly. Rendering is covered by the
    // Playwright suite under a real browser.
    const ticks = (el as unknown as { buildTicks(a: number, b: number, c: number, d: number): Array<{ major: boolean; label?: string }> })
      .buildTicks(5, 4, 0, 100);
    const majorsWithLabel = ticks.filter((t) => t.major && t.label !== undefined);
    expect(majorsWithLabel.length).toBe(5);
  });
});
