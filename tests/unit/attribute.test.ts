import { afterEach, describe, expect, it } from "vitest";
import "../../src/controls/retro-seven-segment.js";
import "../../src/controls/retro-gauge.js";
import type { RetroSevenSegment } from "../../src/controls/retro-seven-segment.js";
import type { RetroGauge } from "../../src/controls/retro-gauge.js";
import { cleanup, makeHass, mount } from "./setup.js";

/**
 * Attribute-aware value resolution + units + the climate indicator. We poke
 * the protected helpers via casts (they back every numeric control).
 */
type Probe = {
  resolvedValue(): number | null;
  resolvedUnit(): string;
  activeAttribute(): string | null;
  isIndicatorActive(): boolean;
};

describe("attribute-aware value resolution", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => { toDispose.forEach(cleanup); toDispose = []; });

  async function seg(config: Record<string, unknown>, states: Record<string, { state: string; attributes?: Record<string, unknown> }>) {
    const hass = makeHass(states);
    const el = await mount<RetroSevenSegment>("retro-seven-segment", (n) => {
      n.hass = hass;
      n.config = { type: "seven_segment", ...config } as never;
    });
    return el as unknown as RetroSevenSegment & Probe;
  }

  it("reads the configured attribute", async () => {
    const el = await seg(
      { entity: "weather.home", attribute: "humidity" },
      { "weather.home": { state: "sunny", attributes: { temperature: 21, humidity: 64 } } },
    );
    toDispose.push(el);
    expect(el.resolvedValue()).toBe(64);
    expect(el.activeAttribute()).toBe("humidity");
  });

  it("defaults weather to temperature when no attribute set", async () => {
    const el = await seg(
      { entity: "weather.home" },
      { "weather.home": { state: "cloudy", attributes: { temperature: 18, humidity: 70, temperature_unit: "°C" } } },
    );
    toDispose.push(el);
    expect(el.activeAttribute()).toBe("temperature");
    expect(el.resolvedValue()).toBe(18);
    expect(el.resolvedUnit()).toBe("°C"); // inferred from temperature_unit
  });

  it("defaults climate to current_temperature and infers % for humidity attr", async () => {
    const el = await seg(
      { entity: "climate.valve", attribute: "current_humidity" },
      { "climate.valve": { state: "heat", attributes: { current_temperature: 19.5, current_humidity: 55 } } },
    );
    toDispose.push(el);
    expect(el.resolvedValue()).toBe(55);
    expect(el.resolvedUnit()).toBe("%");
  });

  it("uses the state directly for a plain numeric sensor", async () => {
    const el = await seg(
      { entity: "sensor.t", unit: "" },
      { "sensor.t": { state: "42", attributes: { unit_of_measurement: "°C" } } },
    );
    toDispose.push(el);
    expect(el.activeAttribute()).toBeNull();
    expect(el.resolvedValue()).toBe(42);
  });

  it("returns null when the chosen attribute is missing", async () => {
    const el = await seg(
      { entity: "weather.home", attribute: "ozone" },
      { "weather.home": { state: "sunny", attributes: { temperature: 21 } } },
    );
    toDispose.push(el);
    expect(el.resolvedValue()).toBeNull();
  });
});

describe("climate indicator (hvac_action)", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => { toDispose.forEach(cleanup); toDispose = []; });

  async function gauge(state: string, attributes: Record<string, unknown>) {
    const hass = makeHass({ "climate.valve": { state, attributes } });
    const el = await mount<RetroGauge>("retro-gauge", (n) => {
      n.hass = hass;
      n.config = { type: "gauge", entity: "climate.valve", min: 0, max: 30 } as never;
    });
    return el as unknown as RetroGauge & Probe;
  }

  it("is active when hvac_action is heating", async () => {
    const el = await gauge("heat", { hvac_action: "heating", current_temperature: 20 });
    toDispose.push(el);
    expect(el.isIndicatorActive()).toBe(true);
  });

  it("is inactive when hvac_action is idle", async () => {
    const el = await gauge("heat", { hvac_action: "idle", current_temperature: 20 });
    toDispose.push(el);
    expect(el.isIndicatorActive()).toBe(false);
  });

  it("falls back to state != off when hvac_action is absent", async () => {
    const on = await gauge("heat", { current_temperature: 20 });
    toDispose.push(on);
    expect(on.isIndicatorActive()).toBe(true);
    const off = await gauge("off", { current_temperature: 20 });
    toDispose.push(off);
    expect(off.isIndicatorActive()).toBe(false);
  });
});
