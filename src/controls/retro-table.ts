import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { HomeAssistant } from "custom-card-helpers";
import type {
  EntityControlConfig,
  LabelStyle,
  TableCellConfig,
  TableCellOptions,
  TableCellType,
  TableConfig,
  TableRowConfig,
} from "../types.js";
import { scaleStyle } from "./scale-style.js";
import { renderEntityControl } from "./render-control.js";
import "./retro-label.js";

/**
 * What a table gives its cells before any column, row or cell settings. A
 * seven-segment cell shows no unit (the header names it); a VU meter lies
 * down, which fits a table row.
 */
const CELL_DEFAULTS: Record<TableCellType, TableCellOptions> = {
  seven_segment: { unit: " " },
  vu_meter: { orientation: "horizontal" },
  gauge: {},
  flip_switch: {},
  button: {},
};

/** A header, label or group name as text; YAML hands over 1 for an unquoted 01. */
function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

/** Where a group of neighbours with the same name starts, and how many it holds. */
interface Run {
  name: string;
  start: number;
  span: number;
}

/** Neighbours with the same name form one run; each unnamed one is a run of its own. */
export function groupRuns(names: string[]): Run[] {
  const runs: Run[] = [];
  for (const [i, name] of names.entries()) {
    const last = runs[runs.length - 1];
    if (name && last?.name === name) last.span++;
    else runs.push({ name, start: i, span: 1 });
  }
  return runs;
}

/**
 * Dense matrix of controls: column headers on top, row labels on the left, a
 * compact control in each cell. The cells are of the table's cell type,
 * unless a column, row or cell sets its own. A cell can do everything the
 * control can; it takes its column's settings, then its row's, then its own.
 * Neighbouring columns can share a group heading above their headers, and
 * neighbouring rows a group name left of their labels.
 */
@customElement("retro-table")
export class RetroTable extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) config!: TableConfig;
  @property({ attribute: false }) labelStyle: LabelStyle = "etched";

  static styles = css`
    :host {
      display: inline-block;
    }
    /* Cells sit at the top of their row: one that also shows a value readout
       or an LED below it stays in line with its neighbours. */
    .table {
      display: grid;
      align-items: start;
      justify-items: center;
      column-gap: 0.4em;
      row-gap: 0.3em;
    }
    /* Cell sizes within the table, so that every type makes a dense grid;
       the table's scale sizes the whole thing. */
    retro-seven-segment { font-size: 0.55em; }
    retro-flip-switch   { font-size: 0.7em; }
    retro-button        { font-size: 0.8em; }
    retro-vu-meter      { font-size: 0.8em; }
    retro-gauge         { font-size: 0.6em; }
    .row-label {
      justify-self: end;
      align-self: center;
      font-size: 1.2em;
    }
    /* Headers are usually units, so unlike labels they keep their case. */
    .header {
      font-size: 0.75em;
      white-space: nowrap;
    }
    .header.etched {
      font-family: var(--retro-label-etched-font);
      color: var(--retro-label-etched-color);
      text-shadow: var(--retro-label-etched-shadow);
      letter-spacing: var(--retro-label-etched-tracking);
    }
    .header.dymo {
      font-family: var(--retro-label-dymo-font);
      color: var(--retro-label-dymo-color);
      background: var(--retro-label-dymo-bg);
      box-shadow: var(--retro-label-dymo-shadow);
      padding: 0.1em 0.4em;
      border-radius: 0.12em;
    }
    .header.none {
      font-family: var(--retro-label-etched-font);
      color: var(--retro-label-etched-color);
    }
    /* Group names: labels like the row labels, scribed into the panel with
       a bracket in the same line as an embossed group's frame. */
    .group-label {
      font-size: 1.2em;
    }
    .group-label.none {
      display: none;
    }
    /* Over its columns: a line either side of the name, with the ends bent
       down towards the headers. */
    .col-group {
      justify-self: stretch;
      align-self: end;
      display: flex;
      align-items: center;
      gap: 0.35em;
    }
    .col-group .rule {
      position: relative;
      flex: 1 1 0;
      min-width: 0.5em;
      border-top: 1px solid var(--retro-label-etched-color);
      box-shadow: var(--retro-label-etched-shadow);
    }
    .col-group .rule::before {
      content: "";
      position: absolute;
      top: -1px;
      height: 0.4em;
      border-left: 1px solid var(--retro-label-etched-color);
      box-shadow: var(--retro-label-etched-shadow);
    }
    .col-group .rule.start::before { left: 0; }
    .col-group .rule.end::before { right: 0; }
    /* Beside its rows: the name, then a bracket from the first row to the
       last, its ends bent towards the row labels. */
    .row-group {
      justify-self: stretch;
      align-self: stretch;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.35em;
    }
    .row-group .brace {
      align-self: stretch;
      width: 0.4em;
      margin: 0.15em 0;
      border: 1px solid var(--retro-label-etched-color);
      border-right: 0;
      box-shadow: var(--retro-label-etched-shadow);
    }
  `;

  /** What the cells are by default; seven-segment unless the table says otherwise. */
  get cellType(): TableCellType {
    return this.config?.cell_type ?? "seven_segment";
  }

  render() {
    const cfg = this.config;
    if (!cfg) return nothing;
    const columns = Array.isArray(cfg.columns) ? cfg.columns : [];
    const rows = Array.isArray(cfg.rows) ? cfg.rows : [];
    const count = Math.max(
      columns.length,
      ...rows.map((r) => (Array.isArray(r?.cells) ? r.cells.length : 0)),
      1,
    );
    const indices = Array.from({ length: count }, (_, i) => i);
    const columnGroups = indices.map((i) => text(columns[i]?.group));
    const rowGroups = rows.map((r) => text(r?.group));
    const withColumnGroups = columnGroups.some(Boolean);
    const withRowGroups = rowGroups.some(Boolean);
    const withLabels = rows.some((r) => !!text(r?.label));
    const withHeaders = columns.some((c) => !!text(c?.header));
    // Columns before the cells: the row groups', then the row labels'.
    const lead = (withRowGroups ? 1 : 0) + (withLabels ? 1 : 0);
    // In a table sized to its content, flexible columns all grow to the
    // widest one's width.
    const track = cfg.equal_columns ? "1fr" : "auto";
    const template = `${"auto ".repeat(lead)}repeat(${count}, ${track})`;
    const corner = html`<span style="grid-column: span ${lead}"></span>`;

    // The grid fills row by row, so the items are simply listed in order:
    // group headings, header line, then each row's group, label and cells.
    // A group spans its neighbours, and the grid places the next items
    // around it.
    const items: TemplateResult[] = [];
    if (withColumnGroups) {
      if (lead) items.push(corner);
      for (const run of groupRuns(columnGroups)) {
        items.push(run.name ? this.renderColumnGroup(run) : html`<span></span>`);
      }
    }
    if (withHeaders) {
      if (lead) items.push(corner);
      for (const i of indices) {
        items.push(html`<span class="header ${this.labelStyle}">${text(columns[i]?.header)}</span>`);
      }
    }
    const rowRuns = new Map(groupRuns(rowGroups).map((run) => [run.start, run]));
    for (const [ri, row] of rows.entries()) {
      const run = rowRuns.get(ri);
      if (withRowGroups && run) items.push(run.name ? this.renderRowGroup(run) : html`<span></span>`);
      if (withLabels) {
        items.push(html`<retro-label
          class="row-label"
          .text=${text(row?.label)}
          .styleName=${this.labelStyle}
        ></retro-label>`);
      }
      for (const i of indices) items.push(this.renderCell(row, i));
    }

    return html`
      <div class="table" part="table" style="grid-template-columns: ${template}; ${scaleStyle(cfg.scale)}">
        ${items}
      </div>
    `;
  }

  private renderColumnGroup(run: Run): TemplateResult {
    return html`<div class="col-group" style="grid-column: span ${run.span}">
      <span class="rule start"></span>
      <retro-label class="group-label ${this.labelStyle}" .text=${run.name} .styleName=${this.labelStyle}></retro-label>
      <span class="rule end"></span>
    </div>`;
  }

  private renderRowGroup(run: Run): TemplateResult {
    return html`<div class="row-group" style="grid-row: span ${run.span}">
      <retro-label class="group-label ${this.labelStyle}" .text=${run.name} .styleName=${this.labelStyle}></retro-label>
      <span class="brace"></span>
    </div>`;
  }

  private renderCell(row: TableRowConfig, i: number): TemplateResult {
    const cell = this.cellConfig(row, i);
    return cell
      ? renderEntityControl(cell, this.hass, this.labelStyle, true)
      : html`<span class="empty"></span>`;
  }

  /**
   * The control config of the cell at column `i`: the table's defaults for
   * its type, then the column's settings, the row's, and the cell's own.
   * The type is decided in the same order: the cell's, the row's, the
   * column's, else the table's. Null for an empty cell. The label isn't shown
   * (the table draws its own) but names the cell for screen readers.
   */
  cellConfig(row: TableRowConfig, i: number): EntityControlConfig | null {
    const raw = Array.isArray(row?.cells) ? row.cells[i] : undefined;
    if (raw === null || raw === undefined || raw === "") return null;
    const cell: TableCellConfig = typeof raw === "string" ? { entity: raw } : raw;
    const column = this.config.columns?.[i] ?? {};
    const type = cell.type ?? row.type ?? column.type ?? this.cellType;
    // Headers, labels, groups and the cell list aren't settings for the cells.
    const { header, group: columnGroup, ...columnSettings } = column;
    const { label: rowLabel, group: rowGroup, ...rowSettings }: Partial<TableRowConfig> = row;
    delete rowSettings.cells;
    const label = [rowGroup, rowLabel, columnGroup, header].map(text).filter(Boolean).join(" ");
    return {
      ...CELL_DEFAULTS[type],
      ...columnSettings,
      ...rowSettings,
      ...cell,
      type,
      label: label || " ",
    } as EntityControlConfig;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "retro-table": RetroTable;
  }
}
