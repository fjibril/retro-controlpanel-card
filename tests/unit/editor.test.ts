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

  it("writes fill_width for a row or group only when it is on", async () => {
    const { el } = await buildEditor();
    toDispose.push(el);
    const handler = vi.fn();
    el.addEventListener("config-changed", handler);
    const editor = el as unknown as {
      _handleRowChange: (ri: number, ev: CustomEvent) => void;
      _handleEntityChange: (path: number[], ev: CustomEvent) => void;
    };
    const ev = (value: Record<string, unknown>) => new CustomEvent("value-changed", { detail: { value } });
    const row = { justify: "center", group_style: "screwed", label: "", label_style: "", scale: 1 };
    const lastRow = () => handler.mock.calls[handler.mock.calls.length - 1][0].detail.config.rows[0];

    editor._handleRowChange(0, ev({ ...row, fill_width: true }));
    expect(lastRow().fill_width).toBe(true);
    editor._handleRowChange(0, ev({ ...row, fill_width: false }));
    expect(lastRow()).not.toHaveProperty("fill_width");

    const hass = makeHass({});
    const group = { type: "group" as const, entities: [{ type: "button" as const }] };
    const groupEditor = await mount<RetroControlPanelCardEditor>("retro-controlpanel-card-editor", (n) => {
      n.hass = hass;
      n.setConfig({ type: "custom:retro-controlpanel-card", rows: [{ entities: [group] }] });
    });
    toDispose.push(groupEditor);
    const groupHandler = vi.fn();
    groupEditor.addEventListener("config-changed", groupHandler);
    const ge = groupEditor as unknown as typeof editor & { _entityFormData: (e: unknown) => Record<string, unknown> };
    expect(ge._entityFormData(group).fill_width).toBe(false);
    ge._handleEntityChange([0, 0], ev({ ...ge._entityFormData(group), fill_width: true }));
    expect(groupHandler.mock.calls[0][0].detail.config.rows[0].entities[0].fill_width).toBe(true);
    ge._handleEntityChange([0, 0], ev({ ...ge._entityFormData(group), fill_width: false }));
    expect(groupHandler.mock.calls[1][0].detail.config.rows[0].entities[0]).not.toHaveProperty("fill_width");
  });

  it("folds a row's settings away above its entities", async () => {
    const { el } = await buildEditor();
    toDispose.push(el);
    await el.updateComplete;
    const rowForm = el.shadowRoot!.querySelector(".row-content > ha-form") as unknown as {
      schema: Array<{ type?: string; title?: string; schema?: unknown[] }>;
      data: Record<string, unknown>;
    };
    expect(rowForm.schema).toHaveLength(1);
    expect(rowForm.schema[0]).toMatchObject({ type: "expandable", title: "Settings for this row", flatten: true });
    const names = (schema: any[]): string[] =>
      schema.flatMap((f) => (f.schema ? names(f.schema) : f.name ? [f.name] : []));
    expect(names(rowForm.schema)).toEqual(["justify", "group_style", "label", "label_style", "scale", "fill_width"]);
    expect(rowForm.data.fill_width).toBe(false);
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

  describe("table", () => {
    type TableEditor = {
      _handleEntityChange: (path: number[], ev: CustomEvent) => void;
      _addTableColumn: (path: number[]) => void;
      _removeTableColumn: (path: number[], ci: number) => void;
      _moveTableColumn: (path: number[], ci: number, delta: number) => void;
      _handleTableColumnChange: (path: number[], ci: number, ev: CustomEvent) => void;
      _addTableRow: (path: number[]) => void;
      _handleTableRowChange: (path: number[], ri: number, count: number, ev: CustomEvent) => void;
    };
    const changed = (value: Record<string, unknown>) => new CustomEvent("value-changed", { detail: { value } });

    /** An editor whose config-changed results are fed back in, like HA does. */
    async function tableEditor(table: Record<string, unknown>) {
      const hass = makeHass({});
      const el = await mount<RetroControlPanelCardEditor>("retro-controlpanel-card-editor", (n) => {
        n.hass = hass;
        n.setConfig({ type: "custom:retro-controlpanel-card", rows: [{ entities: [table as never] }] });
      });
      toDispose.push(el);
      let latest: any;
      el.addEventListener("config-changed", (ev) => {
        latest = (ev as CustomEvent).detail.config;
        el.setConfig(latest);
      });
      return { editor: el as unknown as TableEditor, table: () => latest.rows[0].entities[0] };
    }

    it("switching a control to a table seeds an empty rows list", async () => {
      const { editor, table } = await tableEditor({ type: "seven_segment", entity: "sensor.temp", num_digits: 4 });
      editor._handleEntityChange([0, 0], changed({ type: "table", entity: "sensor.temp", num_digits: 4 }));
      expect(table()).toEqual({ type: "table", rows: [] });
    });

    it("edits columns, dropping cleared fields and keeping YAML-only ones", async () => {
      const { editor, table } = await tableEditor({
        type: "table",
        columns: [{ header: "°C", color_rules: [{ color: "blue", below: 5 }] }],
        rows: [],
      });
      editor._handleTableColumnChange([0, 0], 0, changed({
        header: "°C", color_rules: [{ color: "blue", below: 5 }],
        display_mode: "number", color: "", unit: "", num_digits: 3, maximum_fraction_digits: undefined,
      }));
      expect(table().columns).toEqual([{ header: "°C", color_rules: [{ color: "blue", below: 5 }], num_digits: 3 }]);
      editor._addTableColumn([0, 0]);
      expect(table().columns).toHaveLength(2);
    });

    it("edits a row's label and entities, keeping a cell's own settings", async () => {
      const { editor, table } = await tableEditor({
        type: "table",
        columns: [{ header: "°C" }, { header: "RH %" }],
        rows: [{ label: "LIVING", cells: ["sensor.a", { entity: "sensor.b", color: "blue" }] }],
      });
      editor._handleTableRowChange([0, 0], 0, 2, changed({ label: "LOUNGE", cell_0: "sensor.c", cell_1: "sensor.d" }));
      expect(table().rows).toEqual([{ label: "LOUNGE", cells: ["sensor.c", { entity: "sensor.d", color: "blue" }] }]);
      // Clearing the last entity leaves no trailing empty cell behind.
      editor._handleTableRowChange([0, 0], 0, 2, changed({ label: "", cell_0: "sensor.c", cell_1: "" }));
      expect(table().rows).toEqual([{ cells: ["sensor.c"] }]);
      editor._addTableRow([0, 0]);
      expect(table().rows).toHaveLength(2);
    });

    it("removing or moving a column takes its cells along", async () => {
      const { editor, table } = await tableEditor({
        type: "table",
        columns: [{ header: "A" }, { header: "B" }, { header: "C" }],
        rows: [{ cells: ["sensor.a", "sensor.b", "sensor.c"] }, { cells: ["sensor.x"] }],
      });
      editor._moveTableColumn([0, 0], 0, 1);
      expect(table().columns.map((c: any) => c.header)).toEqual(["B", "A", "C"]);
      expect(table().rows).toEqual([{ cells: ["sensor.b", "sensor.a", "sensor.c"] }, { cells: [null, "sensor.x"] }]);
      editor._removeTableColumn([0, 0], 1);
      expect(table().columns.map((c: any) => c.header)).toEqual(["B", "C"]);
      expect(table().rows).toEqual([{ cells: ["sensor.b", "sensor.c"] }, { cells: [] }]);
    });

    it("keeps a row's settings, even ones that equal a control's default", async () => {
      const { editor, table } = await tableEditor({
        type: "table",
        columns: [{ display_mode: "countdown" }],
        rows: [{ label: "NOW", cells: ["sensor.a"] }],
      });
      // "number" is the default, but here it overrides the column's countdown.
      editor._handleTableRowChange([0, 0], 0, 1, changed({
        label: "NOW", cell_0: "sensor.a", display_mode: "number", show_seconds: false, color: "", num_digits: 4,
      }));
      expect(table().rows).toEqual([{
        label: "NOW", cells: ["sensor.a"], display_mode: "number", show_seconds: false, num_digits: 4,
      }]);
    });

    it("drops a column's settings that are the default anyway", async () => {
      const { editor, table } = await tableEditor({ type: "table", cell_type: "vu_meter", columns: [{}], rows: [] });
      editor._handleTableColumnChange([0, 0], 0, changed({
        header: "RH", orientation: "horizontal", show_value: false, show_scale: true, value_color: "", min: 0,
      }));
      expect(table().columns).toEqual([{ header: "RH", show_scale: true, min: 0 }]);
      editor._handleTableColumnChange([0, 0], 0, changed({ header: "RH", orientation: "vertical" }));
      expect(table().columns[0].orientation).toBe("vertical");
    });

    it("a new cell type drops the settings it doesn't have", async () => {
      const { editor, table } = await tableEditor({
        type: "table",
        columns: [{ header: "°C", num_digits: 3, color: "blue" }],
        rows: [{ label: "LIVING", num_digits: 2, cells: [{ entity: "sensor.a", maximum_fraction_digits: 1, color: "red" }] }],
      });
      editor._handleEntityChange([0, 0], changed({ type: "table", cell_type: "button", scale: 1 }));
      expect(table()).toEqual({
        type: "table",
        cell_type: "button",
        columns: [{ header: "°C", color: "blue" }],
        rows: [{ label: "LIVING", cells: [{ entity: "sensor.a", color: "red" }] }],
      });
      // Seven-segment is the default, so it isn't written out.
      editor._handleEntityChange([0, 0], changed({ type: "table", cell_type: "seven_segment", scale: 1 }));
      expect(table()).not.toHaveProperty("cell_type");
    });

    it("shows the cell type's own settings for columns and rows", async () => {
      const { editor } = await tableEditor({
        type: "table", cell_type: "flip_switch", columns: [{ header: "LIGHT" }], rows: [{ cells: ["light.a"] }],
      });
      await (editor as unknown as RetroControlPanelCardEditor).updateComplete;
      const forms = [...(editor as unknown as HTMLElement).shadowRoot!.querySelectorAll("ha-form")] as any[];
      const names = (schema: any[]): string[] =>
        schema.flatMap((f) => (f.schema ? names(f.schema) : f.name ? [f.name] : []));
      const column = forms.find((f) => names(f.schema).includes("header"));
      const row = forms.find((f) => names(f.schema).includes("cell_0"));
      expect(names(column.schema)).toEqual(expect.arrayContaining(["indicator", "indicator_position", "tap_action"]));
      expect(names(column.schema)).not.toContain("num_digits");
      // The header and group stay in view; the settings fold away.
      expect(names([column.schema[0]])).toEqual(["header", "group"]);
      expect(column.schema[1]).toMatchObject({ type: "expandable", title: "Settings for this column" });
      expect(names(row.schema)).toEqual(expect.arrayContaining(["label", "group", "cell_0", "indicator", "indicator_position"]));
      // An unset row dropdown reads "use the column's".
      expect(row.data.indicator).toBe("");
    });

    it("a row or column with its own type (set in YAML) gets that type's settings", async () => {
      const { editor } = await tableEditor({
        type: "table",
        cell_type: "flip_switch",
        columns: [{ header: "A" }, { header: "B", type: "seven_segment" }],
        rows: [{ label: "BUTTONS", type: "button", cells: ["light.a", "sensor.b"] }],
      });
      await (editor as unknown as RetroControlPanelCardEditor).updateComplete;
      const forms = [...(editor as unknown as HTMLElement).shadowRoot!.querySelectorAll("ha-form")] as any[];
      const names = (schema: any[]): string[] =>
        schema.flatMap((f) => (f.schema ? names(f.schema) : f.name ? [f.name] : []));
      const [a, b] = forms.filter((f) => names(f.schema).includes("header"));
      const row = forms.find((f) => names(f.schema).includes("cell_0"));
      expect(names(a.schema)).toContain("indicator_position"); // the table's type
      expect(names(b.schema)).toContain("num_digits"); // its own
      expect(names(row.schema)).toContain("text"); // a button row
      expect(names(row.schema)).not.toContain("indicator_position");
      // And the type survives an edit, though no field shows it.
      expect(row.data.type).toBe("button");
    });

    it("a new cell type leaves a table that mixes types alone", async () => {
      const mixed = {
        type: "table",
        columns: [{ header: "°C", num_digits: 3 }],
        rows: [{ label: "BUTTONS", type: "button", text: "GO", cells: ["sensor.a"] }],
      };
      const { editor, table } = await tableEditor(mixed);
      editor._handleEntityChange([0, 0], changed({ type: "table", cell_type: "flip_switch", scale: 1 }));
      expect(table()).toEqual({ ...mixed, cell_type: "flip_switch" });
    });

    it("edits the groups of columns and rows, and drops a cleared one", async () => {
      const { editor, table } = await tableEditor({
        type: "table",
        columns: [{ header: "AIRBOX" }],
        rows: [{ label: "°C", cells: ["sensor.a"] }],
      });
      editor._handleTableColumnChange([0, 0], 0, changed({ header: "AIRBOX", group: "LIVING" }));
      editor._handleTableRowChange([0, 0], 0, 1, changed({ label: "°C", group: "UPSTAIRS", cell_0: "sensor.a" }));
      expect(table().columns).toEqual([{ header: "AIRBOX", group: "LIVING" }]);
      expect(table().rows).toEqual([{ label: "°C", group: "UPSTAIRS", cells: ["sensor.a"] }]);
      editor._handleTableColumnChange([0, 0], 0, changed({ header: "AIRBOX", group: "" }));
      editor._handleTableRowChange([0, 0], 0, 1, changed({ label: "°C", group: "", cell_0: "sensor.a" }));
      expect(table().columns).toEqual([{ header: "AIRBOX" }]);
      expect(table().rows).toEqual([{ label: "°C", cells: ["sensor.a"] }]);
    });

    it("a new cell type keeps the groups", async () => {
      const { editor, table } = await tableEditor({
        type: "table",
        columns: [{ header: "AIRBOX", group: "LIVING", num_digits: 3 }],
        rows: [{ label: "°C", group: "UPSTAIRS", cells: ["sensor.a"] }],
      });
      editor._handleEntityChange([0, 0], changed({ type: "table", cell_type: "flip_switch", scale: 1 }));
      expect(table().columns).toEqual([{ header: "AIRBOX", group: "LIVING" }]);
      expect(table().rows).toEqual([{ label: "°C", group: "UPSTAIRS", cells: ["sensor.a"] }]);
    });

    it("writes equal_columns only when it is on", async () => {
      const { editor, table } = await tableEditor({ type: "table", rows: [] });
      editor._handleEntityChange([0, 0], changed({ type: "table", scale: 1, equal_columns: true }));
      expect(table().equal_columns).toBe(true);
      editor._handleEntityChange([0, 0], changed({ type: "table", scale: 1, equal_columns: false }));
      expect(table()).not.toHaveProperty("equal_columns");
    });
  });

  it("exposes getConfigElement on the main card", async () => {
    // Imported lazily so the editor side-effect registers the tag.
    await import("../../src/retro-controlpanel-card.js");
    const { RetroControlPanelCard } = await import("../../src/retro-controlpanel-card.js");
    const editor = RetroControlPanelCard.getConfigElement();
    expect(editor.tagName.toLowerCase()).toBe("retro-controlpanel-card-editor");
  });
});
