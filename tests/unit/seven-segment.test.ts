import { afterEach, describe, expect, it } from "vitest";
import "../../src/controls/retro-seven-segment.js";
import type { RetroSevenSegment } from "../../src/controls/retro-seven-segment.js";
import type { SevenSegmentConfig } from "../../src/types.js";
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

  it("returns dashes for non-numeric state", async () => {
    const { el } = await build({}, "hello");
    toDispose.push(el);
    expect(el.formatTokens(4)).toEqual(["-", "-", "-", "-"]);
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
});
