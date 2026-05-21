import { afterEach, describe, expect, it } from "vitest";
import "../../src/controls/retro-flip-switch.js";
import type { RetroFlipSwitch } from "../../src/controls/retro-flip-switch.js";
import type { FlipSwitchConfig } from "../../src/types.js";
import { cleanup, makeHass, mount } from "./setup.js";

const baseCfg: FlipSwitchConfig = {
  type: "flip_switch",
  entity: "input_boolean.toggle",
};

async function build(state: string, extra: Partial<FlipSwitchConfig> = {}) {
  const hass = makeHass({ "input_boolean.toggle": { state, attributes: {} } });
  const el = await mount<RetroFlipSwitch>("retro-flip-switch", (n) => {
    n.hass = hass;
    n.config = { ...baseCfg, ...extra };
  });
  return { el, hass };
}

describe("retro-flip-switch", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => { toDispose.forEach(cleanup); toDispose = []; });

  it("reflects 'on' state in aria-checked + the .up lever class", async () => {
    const { el } = await build("on");
    toDispose.push(el);
    const row = el.shadowRoot?.querySelector(".row");
    expect(row?.getAttribute("aria-checked")).toBe("true");
    expect(el.shadowRoot?.querySelector(".lever.up")).not.toBeNull();
    expect(el.shadowRoot?.querySelector(".lever.down")).toBeNull();
  });

  it("reflects 'off' state in aria-checked + the .down lever class", async () => {
    const { el } = await build("off");
    toDispose.push(el);
    const row = el.shadowRoot?.querySelector(".row");
    expect(row?.getAttribute("aria-checked")).toBe("false");
    expect(el.shadowRoot?.querySelector(".lever.down")).not.toBeNull();
    expect(el.shadowRoot?.querySelector(".lever.up")).toBeNull();
  });

  it("calls homeassistant.toggle on click for an input_boolean", async () => {
    const { el, hass } = await build("off");
    toDispose.push(el);
    const row = el.shadowRoot!.querySelector(".row") as HTMLElement;
    row.click();
    await el.updateComplete;
    expect(hass.callService).toHaveBeenCalledWith(
      "homeassistant",
      "toggle",
      { entity_id: "input_boolean.toggle" },
    );
  });

  it("toggles on Space keypress", async () => {
    const { el, hass } = await build("off");
    toDispose.push(el);
    const row = el.shadowRoot!.querySelector(".row") as HTMLElement;
    const ev = new KeyboardEvent("keydown", { key: " ", bubbles: true });
    row.dispatchEvent(ev);
    await el.updateComplete;
    expect(hass.callService).toHaveBeenCalled();
  });

  it("hides the indicator unless 'indicator' is configured", async () => {
    const { el } = await build("on");
    toDispose.push(el);
    expect(el.shadowRoot?.querySelector(".indicator")).toBeNull();
  });

  it("renders an indicator on the right by default", async () => {
    const { el } = await build("on", { indicator: "amber" });
    toDispose.push(el);
    const ind = el.shadowRoot?.querySelector(".indicator");
    expect(ind).not.toBeNull();
    expect(ind?.classList.contains("on")).toBe(true);
    // Right means the indicator is the LAST child of .row.
    const row = el.shadowRoot!.querySelector(".row")!;
    expect(row.lastElementChild?.classList.contains("indicator")).toBe(true);
  });

  it("places the indicator on the left when configured", async () => {
    const { el } = await build("off", { indicator: "red", indicator_position: "left" });
    toDispose.push(el);
    const row = el.shadowRoot!.querySelector(".row")!;
    expect(row.firstElementChild?.classList.contains("indicator")).toBe(true);
    // Off entity => indicator not in "on" state
    expect(el.shadowRoot?.querySelector(".indicator.on")).toBeNull();
  });
});
