import { afterEach, describe, expect, it } from "vitest";
import "../../src/retro-controlpanel-card.js";
import type { RetroControlPanelCard } from "../../src/retro-controlpanel-card.js";
import { cleanup, makeHass, mount } from "./setup.js";

const sampleConfig = {
  type: "custom:retro-controlpanel-card",
  title: "Test Panel",
  theme: "amber" as const,
  label_style: "etched" as const,
  rows: [
    {
      entities: [
        { type: "seven_segment" as const, entity: "sensor.temp", num_digits: 4 },
        { type: "vu_meter" as const, entity: "sensor.temp", min: 0, max: 100 },
        { type: "flip_switch" as const, entity: "input_boolean.toggle" },
      ],
    },
    {
      entities: [
        { type: "gauge" as const, entity: "sensor.speed", min: 0, max: 120 },
        { type: "button" as const, entity: "input_button.fire", text: "FIRE" },
      ],
    },
  ],
};

describe("retro-controlpanel-card rendering", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => { toDispose.forEach(cleanup); toDispose = []; });

  async function buildCard() {
    const hass = makeHass({
      "sensor.temp": { state: "21.5" },
      "sensor.speed": { state: "60" },
      "input_boolean.toggle": { state: "on" },
      "input_button.fire": { state: "unknown" },
    });
    const el = await mount<RetroControlPanelCard>("retro-controlpanel-card", (n) => {
      n.setConfig(sampleConfig);
      n.hass = hass;
    });
    // Allow nested controls to settle.
    await new Promise((r) => setTimeout(r, 0));
    return { el, hass };
  }

  it("renders the panel chrome (screws + inner)", async () => {
    const { el } = await buildCard();
    toDispose.push(el);
    expect(el.shadowRoot?.querySelector(".panel")).not.toBeNull();
    expect(el.shadowRoot?.querySelectorAll(".screw").length).toBe(4);
    expect(el.shadowRoot?.querySelector(".panel-inner")).not.toBeNull();
  });

  it("renders the title", async () => {
    const { el } = await buildCard();
    toDispose.push(el);
    const title = el.shadowRoot?.querySelector(".title");
    expect(title?.textContent).toBe("Test Panel");
  });

  it("title inherits the panel label style by default", async () => {
    const { el } = await buildCard(); // sampleConfig has label_style: etched
    toDispose.push(el);
    expect(el.shadowRoot?.querySelector(".title.title-etched")).not.toBeNull();
  });

  it("title_style overrides the panel label style", async () => {
    const hass = makeHass({});
    const el = await mount<RetroControlPanelCard>("retro-controlpanel-card", (n) => {
      n.setConfig({ ...sampleConfig, label_style: "etched", title_style: "dymo" });
      n.hass = hass;
    });
    toDispose.push(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector(".title.title-dymo")).not.toBeNull();
    expect(el.shadowRoot?.querySelector(".title.title-etched")).toBeNull();
  });

  it("renders one .row per configured row", async () => {
    const { el } = await buildCard();
    toDispose.push(el);
    const rows = el.shadowRoot?.querySelectorAll(".row") ?? [];
    expect(rows.length).toBe(2);
  });

  it("renders one of each control type from the sample config", async () => {
    const { el } = await buildCard();
    toDispose.push(el);
    expect(el.shadowRoot?.querySelector("retro-seven-segment")).not.toBeNull();
    expect(el.shadowRoot?.querySelector("retro-vu-meter")).not.toBeNull();
    expect(el.shadowRoot?.querySelector("retro-flip-switch")).not.toBeNull();
    expect(el.shadowRoot?.querySelector("retro-gauge")).not.toBeNull();
    expect(el.shadowRoot?.querySelector("retro-button")).not.toBeNull();
  });

  it("forwards hass + config to each control", async () => {
    const { el, hass } = await buildCard();
    toDispose.push(el);
    const sw = el.shadowRoot!.querySelector("retro-flip-switch") as any;
    expect(sw.hass).toBe(hass);
    expect(sw.config.entity).toBe("input_boolean.toggle");
  });

  it("applies scale via CSS custom property when configured", async () => {
    const hass = makeHass({});
    const el = await mount<RetroControlPanelCard>("retro-controlpanel-card", (n) => {
      n.setConfig({ ...sampleConfig, scale: 1.5 });
      n.hass = hass;
    });
    toDispose.push(el);
    await el.updateComplete;
    expect(el.style.getPropertyValue("--retro-scale")).toBe("1.5");
  });
});
