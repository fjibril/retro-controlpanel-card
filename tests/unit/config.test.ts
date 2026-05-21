import { afterEach, describe, expect, it } from "vitest";
import "../../src/retro-controlpanel-card.js";
import type { RetroControlPanelCard } from "../../src/retro-controlpanel-card.js";
import type { RetroControlPanelCardConfig } from "../../src/types.js";
import { cleanup, mount } from "./setup.js";

async function buildCard(): Promise<RetroControlPanelCard> {
  return mount<RetroControlPanelCard>("retro-controlpanel-card", () => {});
}

const valid: RetroControlPanelCardConfig = {
  type: "custom:retro-controlpanel-card",
  rows: [
    { entities: [{ type: "flip_switch", entity: "input_boolean.x" }] },
  ],
};

describe("setConfig validation", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => { toDispose.forEach(cleanup); toDispose = []; });

  it("accepts a valid config", async () => {
    const el = await buildCard();
    toDispose.push(el);
    expect(() => el.setConfig(valid)).not.toThrow();
  });

  it("throws when rows is missing", async () => {
    const el = await buildCard();
    toDispose.push(el);
    expect(() =>
      el.setConfig({ type: "custom:retro-controlpanel-card" } as RetroControlPanelCardConfig),
    ).toThrow(/rows/);
  });

  it("throws when a row has no entities array", async () => {
    const el = await buildCard();
    toDispose.push(el);
    expect(() =>
      el.setConfig({
        type: "custom:retro-controlpanel-card",
        rows: [{} as any],
      }),
    ).toThrow(/entities/);
  });

  it("throws when an entity has an unknown type", async () => {
    const el = await buildCard();
    toDispose.push(el);
    expect(() =>
      el.setConfig({
        type: "custom:retro-controlpanel-card",
        rows: [{ entities: [{ type: "warp_drive" } as any] }],
      }),
    ).toThrow(/unknown type/);
  });

  it("accepts every legal control type", async () => {
    const el = await buildCard();
    toDispose.push(el);
    expect(() =>
      el.setConfig({
        type: "custom:retro-controlpanel-card",
        rows: [
          {
            entities: [
              { type: "seven_segment", entity: "sensor.a" },
              { type: "vu_meter", entity: "sensor.a" },
              { type: "gauge", entity: "sensor.a" },
              { type: "flip_switch", entity: "input_boolean.x" },
              { type: "button", entity: "input_button.x" },
            ],
          },
        ],
      }),
    ).not.toThrow();
  });

  it("getCardSize returns at least one row of weight", async () => {
    const el = await buildCard();
    toDispose.push(el);
    el.setConfig(valid);
    expect(el.getCardSize()).toBeGreaterThanOrEqual(1);
  });
});
