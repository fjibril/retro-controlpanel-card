import { afterEach, describe, expect, it } from "vitest";
import "../../src/controls/render-control.js";
import type { RetroControlBase } from "../../src/controls/retro-control-base.js";
import type { EntityControlConfig } from "../../src/types.js";
import { cleanup, makeHass, mount } from "./setup.js";

// Compact mode is what a table cell uses: the control alone, without the
// label under it (the table's row label and column header name the cell).
// The controls hide the label in CSS off the reflected attribute, so what
// actually shows is checked in the browser suite (tests/ui).

const hass = makeHass({
  "input_boolean.toggle": { state: "on" },
  "sensor.level": { state: "40" },
});

const CONTROLS: Array<[string, EntityControlConfig, string]> = [
  ["retro-flip-switch", { type: "flip_switch", entity: "input_boolean.toggle", label: "Pump" }, ".row"],
  ["retro-button", { type: "button", entity: "input_boolean.toggle", label: "Pump" }, "button.btn"],
  ["retro-vu-meter", { type: "vu_meter", entity: "sensor.level", label: "Level" }, ".meter"],
  ["retro-gauge", { type: "gauge", entity: "sensor.level", label: "Level" }, ".cutout"],
  ["retro-seven-segment", { type: "seven_segment", entity: "sensor.level", label: "Level" }, ".display"],
];

describe("compact mode", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => { toDispose.forEach(cleanup); toDispose = []; });

  for (const [tag, config, part] of CONTROLS) {
    it(`${tag} reflects compact as an attribute and still renders the control`, async () => {
      const el = await mount<RetroControlBase>(tag, (n) => {
        n.hass = hass;
        n.config = config;
        n.compact = true;
      });
      toDispose.push(el);
      expect(el.hasAttribute("compact")).toBe(true);
      expect(el.shadowRoot!.querySelector(part)).not.toBeNull();
    });
  }

  it("is off by default", async () => {
    const el = await mount<RetroControlBase>("retro-flip-switch", (n) => {
      n.hass = hass;
      n.config = CONTROLS[0][1];
    });
    toDispose.push(el);
    expect(el.hasAttribute("compact")).toBe(false);
  });
});
