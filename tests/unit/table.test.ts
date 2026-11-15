import { afterEach, describe, expect, it } from "vitest";
import { groupRuns } from "../../src/controls/retro-table.js";
import type { RetroTable } from "../../src/controls/retro-table.js";
import type { RetroLabel } from "../../src/controls/retro-label.js";
import type { RetroSevenSegment } from "../../src/controls/retro-seven-segment.js";
import type { TableConfig } from "../../src/types.js";
import { cleanup, makeHass, mount } from "./setup.js";

const STATES = {
  "sensor.living_t": { state: "23.04" },
  "sensor.living_rh": { state: "44" },
  "sensor.outside_t": { state: "4.1" },
  "sensor.outside_rh": { state: "77" },
  "climate.radiator": { state: "heat", attributes: { current_temperature: 19, hvac_action: "heating" } },
};

const ENVIRONMENT: TableConfig = {
  type: "table",
  columns: [
    { header: "°C", num_digits: 3, minimum_fraction_digits: 1, maximum_fraction_digits: 1 },
    { header: "RH %", num_digits: 3 },
  ],
  rows: [
    { label: "LIVING", cells: ["sensor.living_t", "sensor.living_rh"] },
    { label: "OUTSIDE", cells: ["sensor.outside_t", { entity: "sensor.outside_rh", color: "blue" }] },
    { label: "RADIATOR", cells: ["climate.radiator", { entity: "climate.radiator", attribute: "hvac_action", num_digits: 4 }] },
    { label: "EMPTY", cells: [null, "sensor.living_rh"] },
  ],
};

async function build(config: TableConfig) {
  const hass = makeHass(STATES);
  const el = await mount<RetroTable>("retro-table", (n) => {
    n.hass = hass;
    n.config = config;
  });
  return el;
}

describe("retro-table", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => { toDispose.forEach(cleanup); toDispose = []; });

  it("renders a compact display for every filled cell and a gap for empty ones", async () => {
    const el = await build(ENVIRONMENT);
    toDispose.push(el);
    const cells = el.shadowRoot!.querySelectorAll<RetroSevenSegment>("retro-seven-segment");
    expect(cells.length).toBe(7);
    expect([...cells].every((c) => c.hasAttribute("compact"))).toBe(true);
    expect(el.shadowRoot!.querySelectorAll(".empty").length).toBe(1);
  });

  it("gives each cell its column's settings, which the cell can override", async () => {
    const el = await build(ENVIRONMENT);
    toDispose.push(el);
    const [, outside, radiator] = ENVIRONMENT.rows;
    expect(el.cellConfig(outside, 0)).toEqual({
      type: "seven_segment", entity: "sensor.outside_t", label: "OUTSIDE °C",
      unit: " ", num_digits: 3, minimum_fraction_digits: 1, maximum_fraction_digits: 1,
    });
    expect(el.cellConfig(outside, 1)).toMatchObject({ entity: "sensor.outside_rh", color: "blue", num_digits: 3 });
    expect(el.cellConfig(radiator, 1)).toMatchObject({ attribute: "hvac_action", num_digits: 4 });
    expect(el.cellConfig(ENVIRONMENT.rows[3], 0)).toBeNull();
  });

  it("cells show values and text states like any seven-segment display", async () => {
    const el = await build(ENVIRONMENT);
    toDispose.push(el);
    const cells = [...el.shadowRoot!.querySelectorAll<RetroSevenSegment>("retro-seven-segment")];
    expect(cells[0].displayTokens()).toEqual(["2", "3", ".", "0"]);
    expect(cells[5].displayTokens()).toEqual(["h", "e", "a", "t"]);
  });

  it("lays out a label column only when rows have labels, plus one column per data column", async () => {
    const labelled = await build(ENVIRONMENT);
    const bare = await build({ type: "table", rows: [{ cells: ["sensor.living_t", "sensor.living_rh"] }] });
    toDispose.push(labelled, bare);
    const style = (el: RetroTable) => el.shadowRoot!.querySelector<HTMLElement>(".table")!.getAttribute("style");
    expect(style(labelled)).toContain("grid-template-columns: auto repeat(2, auto)");
    expect(style(bare)).toContain("grid-template-columns: repeat(2, auto)");
  });

  it("renders the headers, keeping their case", async () => {
    const el = await build(ENVIRONMENT);
    toDispose.push(el);
    const headers = [...el.shadowRoot!.querySelectorAll(".header")].map((h) => h.textContent);
    expect(headers).toEqual(["°C", "RH %"]);
  });

  it("sizes the whole table with its scale", async () => {
    const el = await build({ ...ENVIRONMENT, scale: 0.7 });
    toDispose.push(el);
    expect(el.shadowRoot!.querySelector(".table")!.getAttribute("style")).toContain("font-size: 0.7em");
  });

  it("a row's settings win over its column's, and a cell's over both", async () => {
    const table: TableConfig = {
      type: "table",
      columns: [{ header: "A", num_digits: 3, color: "blue" }, { header: "B", num_digits: 3 }],
      rows: [
        { label: "TIMES", display_mode: "countdown", num_digits: 4, cells: ["sensor.a", { entity: "sensor.b", num_digits: 2 }] },
        { label: "PLAIN", cells: ["sensor.c"] },
      ],
    };
    const el = await build(table);
    toDispose.push(el);
    const [times, plain] = table.rows;
    expect(el.cellConfig(times, 0)).toMatchObject({ display_mode: "countdown", num_digits: 4, color: "blue" });
    expect(el.cellConfig(times, 1)).toMatchObject({ display_mode: "countdown", num_digits: 2 });
    expect(el.cellConfig(plain, 0)).toMatchObject({ num_digits: 3, color: "blue" });
    // The row's label and cell list are not settings of the cell.
    expect(el.cellConfig(times, 0)).not.toHaveProperty("cells");
    expect(el.cellConfig(times, 0)?.label).toBe("TIMES A");
  });

  it("renders every cell as the table's cell type", async () => {
    const el = await build({
      type: "table",
      cell_type: "flip_switch",
      columns: [{ header: "LIGHT", indicator: "green" }, { header: "FAN" }],
      rows: [
        { label: "LIVING", cells: ["sensor.living_t", "sensor.living_rh"] },
        { label: "OUTSIDE", cells: ["sensor.outside_t"] },
      ],
    });
    toDispose.push(el);
    const switches = el.shadowRoot!.querySelectorAll("retro-flip-switch");
    expect(switches.length).toBe(3);
    expect([...switches].every((s) => s.hasAttribute("compact"))).toBe(true);
    expect(el.shadowRoot!.querySelector("retro-seven-segment")).toBeNull();
    expect(el.cellConfig(el.config.rows[0], 0)).toMatchObject({ type: "flip_switch", indicator: "green" });
  });

  it("lets a column, row or cell set its own type: cell, then row, then column, then table", async () => {
    const table: TableConfig = {
      type: "table",
      cell_type: "flip_switch",
      columns: [{ header: "A" }, { header: "B", type: "seven_segment" }],
      rows: [
        { label: "SWITCHES", cells: ["sensor.living_t", "sensor.living_rh"] },
        { label: "BUTTONS", type: "button", cells: ["sensor.living_t", { entity: "sensor.living_rh", type: "gauge" }] },
      ],
    };
    const el = await build(table);
    toDispose.push(el);
    const [switches, buttons] = table.rows;
    expect(el.cellConfig(switches, 0)?.type).toBe("flip_switch"); // the table's
    expect(el.cellConfig(switches, 1)?.type).toBe("seven_segment"); // the column's
    expect(el.cellConfig(buttons, 0)?.type).toBe("button"); // the row's beats the table's
    expect(el.cellConfig(buttons, 1)?.type).toBe("gauge"); // the cell's beats them all
    const tags = [...el.shadowRoot!.querySelectorAll("[compact]")].map((c) => c.tagName.toLowerCase());
    expect(tags).toEqual(["retro-flip-switch", "retro-seven-segment", "retro-button", "retro-gauge"]);
  });

  it("can make every column as wide as the widest", async () => {
    const el = await build({ ...ENVIRONMENT, equal_columns: true });
    toDispose.push(el);
    expect(el.shadowRoot!.querySelector(".table")!.getAttribute("style"))
      .toContain("grid-template-columns: auto repeat(2, 1fr)");
  });

  it("draws one heading over neighbouring columns of the same group", async () => {
    const el = await build({
      type: "table",
      columns: [
        { group: "LIVING", header: "AIRBOX" },
        { group: "LIVING", header: "T/H 01" },
        { header: "ALONE" },
        { group: "KITCHEN", header: "T/H 03" },
        { group: "LIVING", header: "AGAIN" }, // not a neighbour: a heading of its own
      ],
      rows: [{ label: "°C", cells: ["sensor.living_t", "sensor.living_t", "sensor.living_t", "sensor.outside_t", "sensor.outside_t"] }],
    });
    toDispose.push(el);
    const groups = [...el.shadowRoot!.querySelectorAll<HTMLElement>(".col-group")];
    expect(groups.map((g) => g.querySelector<RetroLabel>("retro-label")!.text)).toEqual(["LIVING", "KITCHEN", "LIVING"]);
    expect(groups.map((g) => g.getAttribute("style"))).toEqual([
      "grid-column: span 2", "grid-column: span 1", "grid-column: span 1",
    ]);
    // Grid items in order: the corner over the row labels, LIVING, a gap over
    // the ungrouped column, KITCHEN, LIVING; then the header line.
    const table = el.shadowRoot!.querySelector(".table")!;
    const line = [...table.children].slice(0, 5);
    expect(line.map((c) => c.className || c.getAttribute("style"))).toEqual([
      "grid-column: span 1", "col-group", null, "col-group", "col-group",
    ]);
    expect(table.children[5].getAttribute("style")).toBe("grid-column: span 1");
    expect(table.children[6].classList.contains("header")).toBe(true);
  });

  it("names neighbouring rows of the same group beside a bracket spanning them", async () => {
    const el = await build({
      type: "table",
      columns: [{ header: "°C" }],
      rows: [
        { group: "LIVING", label: "AIRBOX", cells: ["sensor.living_t"] },
        { group: "LIVING", label: "T/H 01", cells: ["sensor.living_t"] },
        { label: "ALONE", cells: ["sensor.outside_t"] },
        { group: "KITCHEN", label: "T/H 03", cells: ["sensor.outside_t"] },
      ],
    });
    toDispose.push(el);
    const table = el.shadowRoot!.querySelector<HTMLElement>(".table")!;
    // A column for the groups, one for the row labels, then the cells.
    expect(table.getAttribute("style")).toContain("grid-template-columns: auto auto repeat(1, auto)");
    const groups = [...table.querySelectorAll<HTMLElement>(".row-group")];
    expect(groups.map((g) => g.querySelector<RetroLabel>("retro-label")!.text)).toEqual(["LIVING", "KITCHEN"]);
    expect(groups.map((g) => g.getAttribute("style"))).toEqual(["grid-row: span 2", "grid-row: span 1"]);
    expect(groups.every((g) => g.querySelector(".brace"))).toBe(true);
    // The header line's corner covers both leading columns.
    expect(table.children[0].getAttribute("style")).toBe("grid-column: span 2");
    // Rows: LIVING spans the first two, so the second row starts at its
    // label; the ungrouped row has a gap in the group column.
    const after = (i: number) => table.children[i].tagName.toLowerCase() + (table.children[i].className ? "." + table.children[i].className : "");
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(after)).toEqual([
      "div.row-group", "retro-label.row-label", "retro-seven-segment",
      "retro-label.row-label", "retro-seven-segment",
      "span", "retro-label.row-label", "retro-seven-segment",
      "div.row-group", "retro-label.row-label",
    ]);
  });

  it("doesn't give the groups to the cells as settings, but names the cells with them", async () => {
    const table: TableConfig = {
      type: "table",
      columns: [{ group: "LIVING", header: "AIRBOX" }],
      rows: [{ group: "UPSTAIRS", label: "°C", cells: ["sensor.living_t"] }],
    };
    const el = await build(table);
    toDispose.push(el);
    const cell = el.cellConfig(table.rows[0], 0);
    expect(cell).not.toHaveProperty("group");
    expect(cell?.label).toBe("UPSTAIRS °C LIVING AIRBOX");
  });

  it("takes numbers for headers, labels and groups, as YAML gives for 01", async () => {
    const el = await build({
      type: "table",
      columns: [{ group: 2 as unknown as string, header: 1 as unknown as string }],
      rows: [{ label: 3 as unknown as string, cells: ["sensor.living_t"] }],
    });
    toDispose.push(el);
    expect(el.shadowRoot!.querySelector(".header")!.textContent).toBe("1");
    expect(el.shadowRoot!.querySelector<RetroLabel>(".col-group retro-label")!.text).toBe("2");
    expect(el.shadowRoot!.querySelector<RetroLabel>(".row-label")!.text).toBe("3");
  });

  it("runs of the same name only join neighbours", () => {
    expect(groupRuns(["A", "A", "", "", "B", "A"])).toEqual([
      { name: "A", start: 0, span: 2 },
      { name: "", start: 2, span: 1 },
      { name: "", start: 3, span: 1 },
      { name: "B", start: 4, span: 1 },
      { name: "A", start: 5, span: 1 },
    ]);
  });

  it("gives each cell type its own defaults", async () => {
    const vu = await build({ type: "table", cell_type: "vu_meter", rows: [{ cells: ["sensor.living_rh"] }] });
    const upright = await build({
      type: "table", cell_type: "vu_meter", columns: [{ orientation: "vertical" }], rows: [{ cells: ["sensor.living_rh"] }],
    });
    const gauge = await build({ type: "table", cell_type: "gauge", rows: [{ cells: ["sensor.living_t"] }] });
    toDispose.push(vu, upright, gauge);
    // VU meters lie down in a table, unless set upright.
    expect(vu.cellConfig(vu.config.rows[0], 0)).toMatchObject({ orientation: "horizontal" });
    expect(upright.cellConfig(upright.config.rows[0], 0)).toMatchObject({ orientation: "vertical" });
    // Only a seven-segment cell hides its unit; a gauge prints it on the dial.
    expect(gauge.cellConfig(gauge.config.rows[0], 0)).not.toHaveProperty("unit");
  });
});
