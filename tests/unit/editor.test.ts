import { afterEach, describe, expect, it, vi } from "vitest";
import "../../src/editor.js";
import type { RetroControlPanelCardEditor } from "../../src/editor.js";
import type { RetroControlPanelCardConfig } from "../../src/types.js";
import { cleanup, makeHass, mount } from "./setup.js";

const baseConfig: RetroControlPanelCardConfig = {
  type: "custom:retro-controlpanel-card",
  title: "Test",
  theme: "amber",
  label_style: "etched",
  rows: [
    {
      entities: [
        { type: "flip_switch", entity: "input_boolean.toggle" },
        { type: "button", entity: "input_button.fire", text: "FIRE" },
      ],
    },
    {
      entities: [
        { type: "seven_segment", entity: "sensor.temp", num_digits: 4 },
      ],
    },
  ],
};

async function buildEditor() {
  const hass = makeHass({});
  const el = await mount<RetroControlPanelCardEditor>("retro-controlpanel-card-editor", (n) => {
    n.hass = hass;
    n.setConfig(structuredClone(baseConfig));
  });
  return { el, hass };
}

describe("retro-controlpanel-card-editor", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => {
    toDispose.forEach(cleanup);
    toDispose = [];
  });

  it("mounts and renders without errors", async () => {
    const { el } = await buildEditor();
    toDispose.push(el);
    expect(el.shadowRoot?.querySelector(".editor")).not.toBeNull();
  });

  it("fires config-changed when a row is added", async () => {
    const { el } = await buildEditor();
    toDispose.push(el);
    const handler = vi.fn();
    el.addEventListener("config-changed", handler);
    // Reach into the editor to invoke the same handler an Add-Row click would.
    (el as unknown as { _addRow: () => void })._addRow();
    expect(handler).toHaveBeenCalledTimes(1);
    const detail = handler.mock.calls[0][0].detail.config;
    expect(detail.rows.length).toBe(baseConfig.rows.length + 1);
  });

  it("fires config-changed when an entity is removed", async () => {
    const { el } = await buildEditor();
    toDispose.push(el);
    const handler = vi.fn();
    el.addEventListener("config-changed", handler);
    (el as unknown as { _removeEntity: (path: number[]) => void })._removeEntity([0, 0]);
    expect(handler).toHaveBeenCalledTimes(1);
    const detail = handler.mock.calls[0][0].detail.config;
    expect(detail.rows[0].entities.length).toBe(baseConfig.rows[0].entities.length - 1);
    expect(detail.rows[0].entities[0].entity).toBe("input_button.fire");
  });

  it("moves an entity right", async () => {
    const { el } = await buildEditor();
    toDispose.push(el);
    const handler = vi.fn();
    el.addEventListener("config-changed", handler);
    (el as unknown as { _moveEntity: (path: number[], delta: number) => void })._moveEntity([0, 0], 1);
    const newRow = handler.mock.calls[0][0].detail.config.rows[0];
    expect(newRow.entities[0].entity).toBe("input_button.fire");
    expect(newRow.entities[1].entity).toBe("input_boolean.toggle");
  });

  it("prunes stale fields when entity type changes", async () => {
    const { el } = await buildEditor();
    toDispose.push(el);
    const handler = vi.fn();
    el.addEventListener("config-changed", handler);

    // Simulate ha-form value-changed on the third entity (seven_segment),
    // changing the type to button. num_digits should be pruned.
    const fakeEvent = new CustomEvent("value-changed", {
      detail: { value: { type: "button", entity: "sensor.temp", num_digits: 4 } },
    });
    (el as unknown as { _handleEntityChange: (path: number[], ev: CustomEvent) => void })._handleEntityChange(
      [1, 0], fakeEvent,
    );
    const ent = handler.mock.calls[0][0].detail.config.rows[1].entities[0];
    expect(ent.type).toBe("button");
    expect(ent.entity).toBe("sensor.temp");
    expect(ent.num_digits).toBeUndefined();
  });

  it("seeds an entities array when switching an entity type to 'group'", async () => {
    const { el } = await buildEditor();
    toDispose.push(el);
    const handler = vi.fn();
    el.addEventListener("config-changed", handler);

    // Change the flip_switch at [0, 0] to a group.
    const fakeEvent = new CustomEvent("value-changed", {
      detail: { value: { type: "group", label: "MY GROUP" } },
    });
    (el as unknown as { _handleEntityChange: (path: number[], ev: CustomEvent) => void })._handleEntityChange(
      [0, 0], fakeEvent,
    );
    const ent = handler.mock.calls[0][0].detail.config.rows[0].entities[0];
    expect(ent.type).toBe("group");
    expect(ent.label).toBe("MY GROUP");
    expect(Array.isArray(ent.entities)).toBe(true);
    expect(ent.entities.length).toBe(0);
  });

  it("adds an entity inside a group via a nested parent path", async () => {
    const hass = makeHass({});
    const el = await mount<RetroControlPanelCardEditor>("retro-controlpanel-card-editor", (n) => {
      n.hass = hass;
      n.setConfig({
        type: "custom:retro-controlpanel-card",
        rows: [
          {
            entities: [
              { type: "group", entities: [], label: "G" },
            ],
          },
        ],
      });
    });
    toDispose.push(el);
    const handler = vi.fn();
    el.addEventListener("config-changed", handler);

    (el as unknown as { _addEntity: (parentPath: number[]) => void })._addEntity([0, 0]);
    const group = handler.mock.calls[0][0].detail.config.rows[0].entities[0];
    expect(group.type).toBe("group");
    expect(group.entities.length).toBe(1);
    expect(group.entities[0].type).toBe("button");
  });

  it("moves an entity inside a group", async () => {
    const hass = makeHass({});
    const el = await mount<RetroControlPanelCardEditor>("retro-controlpanel-card-editor", (n) => {
      n.hass = hass;
      n.setConfig({
        type: "custom:retro-controlpanel-card",
        rows: [
          {
            entities: [
              {
                type: "group",
                label: "G",
                entities: [
                  { type: "button", entity: "input_button.a" },
                  { type: "button", entity: "input_button.b" },
                ],
              },
            ],
          },
        ],
      });
    });
    toDispose.push(el);
    const handler = vi.fn();
    el.addEventListener("config-changed", handler);

    (el as unknown as { _moveEntity: (path: number[], delta: number) => void })._moveEntity([0, 0, 0], 1);
    const group = handler.mock.calls[0][0].detail.config.rows[0].entities[0];
    expect(group.entities[0].entity).toBe("input_button.b");
    expect(group.entities[1].entity).toBe("input_button.a");
  });

  it("prunes default time options and drops a numeric attribute when switching to a time mode", async () => {
    const hass = makeHass({});
    const el = await mount<RetroControlPanelCardEditor>("retro-controlpanel-card-editor", (n) => {
      n.hass = hass;
      n.setConfig({
        type: "custom:retro-controlpanel-card",
        rows: [{ entities: [{ type: "seven_segment", entity: "weather.home", attribute: "temperature" }] }],
      });
    });
    toDispose.push(el);
    const handler = vi.fn();
    el.addEventListener("config-changed", handler);
    const change = (value: Record<string, unknown>) =>
      (el as unknown as { _handleEntityChange: (path: number[], ev: CustomEvent) => void })._handleEntityChange(
        [0, 0],
        new CustomEvent("value-changed", { detail: { value } }),
      );

    // The seeded defaults come back from ha-form; they must not end up in YAML.
    change({ type: "seven_segment", entity: "weather.home", attribute: "temperature", display_mode: "number", show_seconds: false });
    const kept = handler.mock.calls[0][0].detail.config.rows[0].entities[0];
    expect(kept.display_mode).toBeUndefined();
    expect(kept.show_seconds).toBeUndefined();
    expect(kept.attribute).toBe("temperature");

    change({ type: "seven_segment", entity: "weather.home", attribute: "temperature", display_mode: "countdown", show_seconds: true });
    const switched = handler.mock.calls[1][0].detail.config.rows[0].entities[0];
    expect(switched.display_mode).toBe("countdown");
    expect(switched.show_seconds).toBe(true);
    expect(switched.attribute).toBeUndefined();
  });

  it("keeps a row scale but drops the default of 1", async () => {
    const { el } = await buildEditor();
    toDispose.push(el);
    const handler = vi.fn();
    el.addEventListener("config-changed", handler);
    const rowChange = (value: Record<string, unknown>) =>
      (el as unknown as { _handleRowChange: (ri: number, ev: CustomEvent) => void })._handleRowChange(
        0,
        new CustomEvent("value-changed", { detail: { value } }),
      );
    const form = { justify: "center", group_style: "none", label: "", label_style: "" };

    rowChange({ ...form, scale: 0.8 });
    expect(handler.mock.calls[0][0].detail.config.rows[0].scale).toBe(0.8);

    rowChange({ ...form, scale: 1 });
    expect("scale" in handler.mock.calls[1][0].detail.config.rows[0]).toBe(false);
  });

  it("editing a group drops the default scale and keeps keys without a form field", async () => {
    const hass = makeHass({});
    const group = { type: "group" as const, width: "12em", scale: 0.9, entities: [{ type: "button" as const }] };
    const el = await mount<RetroControlPanelCardEditor>("retro-controlpanel-card-editor", (n) => {
      n.hass = hass;
      n.setConfig({ type: "custom:retro-controlpanel-card", rows: [{ entities: [group] }] });
    });
    toDispose.push(el);
    const handler = vi.fn();
    el.addEventListener("config-changed", handler);
    const editor = el as unknown as {
      _entityFormData: (ent: unknown) => Record<string, unknown>;
      _handleEntityChange: (path: number[], ev: CustomEvent) => void;
    };

    // ha-form hands back its data object with the edited field replaced.
    const value = { ...editor._entityFormData(group), scale: 1 };
    editor._handleEntityChange([0, 0], new CustomEvent("value-changed", { detail: { value } }));
    const ent = handler.mock.calls[0][0].detail.config.rows[0].entities[0];
    expect("scale" in ent).toBe(false);
    expect(ent.width).toBe("12em");
    expect(ent.entities).toHaveLength(1);
  });

  it("adds, edits, reorders and removes colour rules on a seven-segment display", async () => {
    const { el } = await buildEditor(); // rows[1].entities[0] is the seven_segment
    toDispose.push(el);
    const editor = el as unknown as {
      _addRule: (path: number[]) => void;
      _removeRule: (path: number[], ri: number) => void;
      _moveRule: (path: number[], ri: number, delta: number) => void;
      _handleRuleChange: (path: number[], ri: number, ev: CustomEvent) => void;
    };
    // Feed each change back in, as Home Assistant does with config-changed.
    let latest: any;
    el.addEventListener("config-changed", (ev) => {
      latest = (ev as CustomEvent).detail.config;
      el.setConfig(latest);
    });
    const rules = () => latest.rows[1].entities[0].color_rules;

    editor._addRule([1, 0]);
    expect(rules()).toEqual([{ color: "red" }]);

    // ha-form reports cleared fields as "" / undefined; they must not be saved.
    editor._handleRuleChange([1, 0], 0, new CustomEvent("value-changed", {
      detail: { value: { color: "green", entity: "", above: undefined, below: 0 } },
    }));
    expect(rules()).toEqual([{ color: "green", below: 0 }]);

    editor._addRule([1, 0]);
    editor._handleRuleChange([1, 0], 1, new CustomEvent("value-changed", {
      detail: { value: { color: "red", entity: "sensor.next", below: 0 } },
    }));
    editor._moveRule([1, 0], 1, -1);
    expect(rules()).toEqual([
      { color: "red", entity: "sensor.next", below: 0 },
      { color: "green", below: 0 },
    ]);

    editor._removeRule([1, 0], 0);
    editor._removeRule([1, 0], 0);
    expect("color_rules" in latest.rows[1].entities[0]).toBe(false);
    // The rest of the display's config is untouched.
    expect(latest.rows[1].entities[0].num_digits).toBe(4);
  });

  it("keeps colour rules when another field of the display is edited", async () => {
    const hass = makeHass({});
    const display = {
      type: "seven_segment" as const,
      entity: "sensor.temp",
      color_rules: [{ color: "red" as const, above: 25 }],
    };
    const el = await mount<RetroControlPanelCardEditor>("retro-controlpanel-card-editor", (n) => {
      n.hass = hass;
      n.setConfig({ type: "custom:retro-controlpanel-card", rows: [{ entities: [display] }] });
    });
    toDispose.push(el);
    const handler = vi.fn();
    el.addEventListener("config-changed", handler);
    const editor = el as unknown as {
      _entityFormData: (ent: unknown) => Record<string, unknown>;
      _handleEntityChange: (path: number[], ev: CustomEvent) => void;
    };

    const value = { ...editor._entityFormData(display), num_digits: 6 };
    editor._handleEntityChange([0, 0], new CustomEvent("value-changed", { detail: { value } }));
    const ent = handler.mock.calls[0][0].detail.config.rows[0].entities[0];
    expect(ent.num_digits).toBe(6);
    expect(ent.color_rules).toEqual([{ color: "red", above: 25 }]);
  });

  it("exposes getConfigElement on the main card", async () => {
    // Imported lazily so the editor side-effect registers the tag.
    await import("../../src/retro-controlpanel-card.js");
    const { RetroControlPanelCard } = await import("../../src/retro-controlpanel-card.js");
    const editor = RetroControlPanelCard.getConfigElement();
    expect(editor.tagName.toLowerCase()).toBe("retro-controlpanel-card-editor");
  });
});
