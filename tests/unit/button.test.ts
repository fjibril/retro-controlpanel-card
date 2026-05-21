import { afterEach, describe, expect, it } from "vitest";
import "../../src/controls/retro-button.js";
import type { RetroButton } from "../../src/controls/retro-button.js";
import type { ButtonConfig } from "../../src/types.js";
import { cleanup, makeHass, mount } from "./setup.js";

async function build(cfg: ButtonConfig, hassStates: Record<string, { state: string }> = {}) {
  const hass = makeHass(hassStates);
  const el = await mount<RetroButton>("retro-button", (n) => {
    n.hass = hass;
    n.config = cfg;
  });
  return { el, hass };
}

describe("retro-button", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => { toDispose.forEach(cleanup); toDispose = []; });

  it("shows 'on' face when bound entity is on", async () => {
    const { el } = await build(
      { type: "button", entity: "input_boolean.lab" },
      { "input_boolean.lab": { state: "on" } },
    );
    toDispose.push(el);
    expect(el.shadowRoot?.querySelector(".face.on")).not.toBeNull();
  });

  it("shows the 'off' face when entity is off", async () => {
    const { el } = await build(
      { type: "button", entity: "input_boolean.lab" },
      { "input_boolean.lab": { state: "off" } },
    );
    toDispose.push(el);
    expect(el.shadowRoot?.querySelector(".face.on")).toBeNull();
  });

  it("toggles a switchable entity on click", async () => {
    const { el, hass } = await build(
      { type: "button", entity: "input_boolean.lab" },
      { "input_boolean.lab": { state: "off" } },
    );
    toDispose.push(el);
    const btn = el.shadowRoot!.querySelector("button.btn") as HTMLButtonElement;
    btn.click();
    await el.updateComplete;
    expect(hass.callService).toHaveBeenCalledWith(
      "homeassistant",
      "toggle",
      { entity_id: "input_boolean.lab" },
    );
  });

  it("presses an input_button via input_button.press", async () => {
    const { el, hass } = await build(
      { type: "button", entity: "input_button.fire" },
      { "input_button.fire": { state: "unknown" } },
    );
    toDispose.push(el);
    const btn = el.shadowRoot!.querySelector("button.btn") as HTMLButtonElement;
    btn.click();
    await el.updateComplete;
    expect(hass.callService).toHaveBeenCalledWith(
      "input_button",
      "press",
      { entity_id: "input_button.fire" },
    );
  });

  it("calls script.turn_on for a script entity", async () => {
    const { el, hass } = await build(
      { type: "button", entity: "script.new_script" },
      { "script.new_script": { state: "off" } },
    );
    toDispose.push(el);
    const btn = el.shadowRoot!.querySelector("button.btn") as HTMLButtonElement;
    btn.click();
    await el.updateComplete;
    expect(hass.callService).toHaveBeenCalledWith(
      "script",
      "turn_on",
      { entity_id: "script.new_script" },
    );
  });

  it("renders the configured text on the button face", async () => {
    const { el } = await build(
      { type: "button", entity: "input_button.fire", text: "LAUNCH" },
      { "input_button.fire": { state: "unknown" } },
    );
    toDispose.push(el);
    const face = el.shadowRoot!.querySelector(".face");
    expect(face?.textContent?.trim()).toBe("LAUNCH");
  });

  it("respects an explicit tap_action override (call-service)", async () => {
    const { el, hass } = await build(
      {
        type: "button",
        entity: "input_boolean.lab",
        tap_action: {
          action: "call-service",
          service: "light.turn_on",
          service_data: { entity_id: "light.lamp", brightness: 200 },
        },
      },
      { "input_boolean.lab": { state: "off" } },
    );
    toDispose.push(el);
    const btn = el.shadowRoot!.querySelector("button.btn") as HTMLButtonElement;
    btn.click();
    await el.updateComplete;
    expect(hass.callService).toHaveBeenCalledWith(
      "light",
      "turn_on",
      { entity_id: "light.lamp", brightness: 200 },
    );
  });
});
