import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCardEditor } from "custom-card-helpers";
import type {
  ControlConfig,
  ControlType,
  RetroControlPanelCardConfig,
  RowConfig,
} from "./types.js";

/**
 * Visual editor for retro-controlpanel-card.
 *
 * Driven by HA's `<ha-form>` (defined globally in the HA frontend), so we just
 * declare the schema for each section + per-control-type and let HA render the
 * right widgets. Rows and entities are list-edited with collapsible panels
 * + reorder/delete buttons - HA does not provide a built-in array editor we
 * can rely on across versions, so this part is custom.
 */

// ---- option lists ---------------------------------------------------------

const TYPE_OPTIONS = [
  { value: "flip_switch",   label: "Flip switch" },
  { value: "button",        label: "Button" },
  { value: "seven_segment", label: "Seven-segment display" },
  { value: "vu_meter",      label: "VU meter" },
  { value: "gauge",         label: "Gauge" },
];

const THEME_OPTIONS = [
  { value: "amber",     label: "Amber CRT" },
  { value: "green",     label: "Green phosphor" },
  { value: "red",       label: "Red alarm" },
  { value: "aluminium", label: "Brushed aluminium" },
];

const LABEL_STYLE_OPTIONS = [
  { value: "etched", label: "Etched (engraved)" },
  { value: "dymo",   label: "Dymo (embossed tape)" },
  { value: "none",   label: "None" },
];

const GLOW_COLOR_OPTIONS = [
  { value: "amber", label: "Amber" },
  { value: "green", label: "Green" },
  { value: "red",   label: "Red" },
  { value: "white", label: "White" },
  { value: "blue",  label: "Blue" },
];

const JUSTIFY_OPTIONS = [
  { value: "center",        label: "Center" },
  { value: "start",         label: "Start" },
  { value: "end",           label: "End" },
  { value: "space-between", label: "Space between" },
  { value: "space-around",  label: "Space around" },
];

const ORIENTATION_OPTIONS = [
  { value: "vertical",   label: "Vertical" },
  { value: "horizontal", label: "Horizontal" },
];

// ---- schemas --------------------------------------------------------------
// `ha-form` accepts loosely-typed selector schemas; we use `any[]` here
// because the HA frontend's exact schema shape is not in custom-card-helpers.

type FormSchema = readonly unknown[];

const CARD_SCHEMA: FormSchema = [
  { name: "title", selector: { text: {} } },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "theme",       selector: { select: { options: THEME_OPTIONS, mode: "dropdown" } } },
      { name: "label_style", selector: { select: { options: LABEL_STYLE_OPTIONS, mode: "dropdown" } } },
    ],
  },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "title_style", selector: { select: {
        options: [{ value: "", label: "(inherit label style)" }, ...LABEL_STYLE_OPTIONS],
        mode: "dropdown",
      } } },
      { name: "scale", selector: { number: { min: 0.5, max: 2, step: 0.05, mode: "slider" } } },
    ],
  },
];

const ROW_SCHEMA: FormSchema = [
  { name: "justify", selector: { select: { options: JUSTIFY_OPTIONS, mode: "dropdown" } } },
];

const COMMON_ENTITY_FIELDS: FormSchema = [
  // The entity selector is a taller boxed control whose label renders above
  // it, so it doesn't line up when gridded next to a plain dropdown. Keep
  // type / entity / label each on their own full-width row.
  { name: "type",   selector: { select: { options: TYPE_OPTIONS, mode: "dropdown" } } },
  { name: "entity", selector: { entity: {} } },
  { name: "label",  selector: { text: {} } },
];

const INDICATOR_POSITION_OPTIONS = [
  { value: "right", label: "Right" },
  { value: "left",  label: "Left" },
];

const ACTION_FIELDS: FormSchema = [
  { name: "tap_action",        selector: { ui_action: {} } },
  { name: "hold_action",       selector: { ui_action: {} } },
  { name: "double_tap_action", selector: { ui_action: {} } },
];

const SCHEMAS_BY_TYPE: Record<ControlType, FormSchema> = {
  flip_switch: [
    ...COMMON_ENTITY_FIELDS,
    {
      type: "grid",
      name: "",
      schema: [
        { name: "indicator",          selector: { select: { options: GLOW_COLOR_OPTIONS, mode: "dropdown" } } },
        { name: "indicator_position", selector: { select: { options: INDICATOR_POSITION_OPTIONS, mode: "dropdown" } } },
      ],
    },
    ...ACTION_FIELDS,
  ],
  button: [
    ...COMMON_ENTITY_FIELDS,
    {
      type: "grid",
      name: "",
      schema: [
        { name: "color", selector: { select: { options: GLOW_COLOR_OPTIONS, mode: "dropdown" } } },
        { name: "text",  selector: { text: {} } },
      ],
    },
    ...ACTION_FIELDS,
  ],
  seven_segment: [
    ...COMMON_ENTITY_FIELDS,
    {
      type: "grid",
      name: "",
      schema: [
        { name: "num_digits", selector: { number: { min: 1, max: 10, step: 1, mode: "box" } } },
        { name: "color",      selector: { select: { options: GLOW_COLOR_OPTIONS, mode: "dropdown" } } },
      ],
    },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "maximum_fraction_digits", selector: { number: { min: 0, max: 6, step: 1, mode: "box" } } },
        { name: "minimum_fraction_digits", selector: { number: { min: 0, max: 6, step: 1, mode: "box" } } },
      ],
    },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "leading_zeros", selector: { boolean: {} } },
        { name: "unit",          selector: { text: {} } },
      ],
    },
    ...ACTION_FIELDS,
  ],
  vu_meter: [
    ...COMMON_ENTITY_FIELDS,
    {
      type: "grid",
      name: "",
      schema: [
        { name: "min", selector: { number: { mode: "box" } } },
        { name: "max", selector: { number: { mode: "box" } } },
      ],
    },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "segments",    selector: { number: { min: 2, max: 30, step: 1, mode: "box" } } },
        { name: "orientation", selector: { select: { options: ORIENTATION_OPTIONS, mode: "dropdown" } } },
      ],
    },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "green_threshold",  selector: { number: { min: 0, max: 100, step: 5, mode: "slider" } } },
        { name: "yellow_threshold", selector: { number: { min: 0, max: 100, step: 5, mode: "slider" } } },
      ],
    },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "show_scale",      selector: { boolean: {} } },
        { name: "scale_divisions", selector: { number: { min: 1, max: 10, step: 1, mode: "box" } } },
      ],
    },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "show_value", selector: { boolean: {} } },
        { name: "value_size", selector: { number: { min: 0.3, max: 2, step: 0.05, mode: "box" } } },
      ],
    },
    ...ACTION_FIELDS,
  ],
  gauge: [
    ...COMMON_ENTITY_FIELDS,
    {
      type: "grid",
      name: "",
      schema: [
        { name: "min", selector: { number: { mode: "box" } } },
        { name: "max", selector: { number: { mode: "box" } } },
      ],
    },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "major_ticks", selector: { number: { min: 2, max: 20, step: 1, mode: "box" } } },
        { name: "minor_ticks", selector: { number: { min: 0, max: 20, step: 1, mode: "box" } } },
      ],
    },
    { name: "unit", selector: { text: {} } },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "show_value", selector: { boolean: {} } },
        { name: "value_size", selector: { number: { min: 0.3, max: 2, step: 0.05, mode: "box" } } },
      ],
    },
    ...ACTION_FIELDS,
  ],
};

/** Keys that may legally appear on each control type - used to prune stale
    fields when the user changes a control's type via the form. `width`/`height`
    are still allowed in YAML for power-users; `label_style` is intentionally
    omitted - label style is always inherited from the panel. */
const COMMON_KEYS = [
  "type", "entity", "label", "width", "height",
  "tap_action", "hold_action", "double_tap_action",
] as const;

const VALID_KEYS_BY_TYPE: Record<ControlType, ReadonlySet<string>> = {
  flip_switch: new Set([
    ...COMMON_KEYS,
    "indicator", "indicator_position",
  ]),
  button: new Set([
    ...COMMON_KEYS,
    "color", "text",
  ]),
  seven_segment: new Set([
    ...COMMON_KEYS,
    "num_digits", "leading_zeros", "maximum_fraction_digits",
    "minimum_fraction_digits", "unit", "color",
  ]),
  vu_meter: new Set([
    ...COMMON_KEYS,
    "min", "max", "segments", "orientation",
    "green_threshold", "yellow_threshold",
    "show_scale", "scale_divisions", "show_value", "value_size",
  ]),
  gauge: new Set([
    ...COMMON_KEYS,
    "min", "max", "unit", "major_ticks", "minor_ticks", "show_value", "value_size",
  ]),
};

// ---- editor element -------------------------------------------------------

@customElement("retro-controlpanel-card-editor")
export class RetroControlPanelCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: RetroControlPanelCardConfig;

  public setConfig(config: RetroControlPanelCardConfig): void {
    this._config = config;
  }

  static styles = css`
    :host {
      display: block;
    }
    .editor {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .section-title {
      margin: 4px 0 4px 0;
      font-size: 15px;
      font-weight: 500;
      color: var(--primary-text-color);
    }
    .panel-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    ha-expansion-panel {
      --expansion-panel-summary-padding: 0 12px;
      --expansion-panel-content-padding: 0 12px 12px 12px;
      border: 1px solid var(--divider-color);
      border-radius: 6px;
      background: var(--card-background-color);
    }
    ha-expansion-panel ha-expansion-panel {
      /* Nested entity panels - slightly indented, lighter border. */
      background: var(--secondary-background-color, transparent);
    }
    .row-header,
    .entity-header {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding-right: 4px;
      box-sizing: border-box;
    }
    .header-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .type-chip {
      display: inline-block;
      background: var(--primary-color);
      color: var(--text-primary-color, white);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-right: 6px;
    }
    .entity-id {
      color: var(--secondary-text-color);
      font-family: var(--code-font-family, monospace);
      font-size: 12px;
    }
    .row-actions,
    .entity-actions {
      display: flex;
      align-items: center;
      gap: 0;
    }
    .row-content,
    .entity-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 0 4px 0;
    }
    .actions-bar {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
    .muted {
      color: var(--secondary-text-color);
      font-weight: normal;
    }
    .empty {
      padding: 8px 12px;
      color: var(--secondary-text-color);
      font-style: italic;
    }
  `;

  render() {
    if (!this.hass || !this._config) return html`<div class="empty">Loading...</div>`;

    const cardData = {
      title: this._config.title ?? "",
      theme: this._config.theme ?? "amber",
      label_style: this._config.label_style ?? "etched",
      title_style: this._config.title_style ?? "",
      scale: this._config.scale ?? 1,
    };

    return html`
      <div class="editor">
        <ha-form
          .hass=${this.hass}
          .data=${cardData}
          .schema=${CARD_SCHEMA}
          .computeLabel=${this._computeLabel}
          @value-changed=${this._handleCardChange}
        ></ha-form>

        <div>
          <div class="section-title">Rows</div>
          <div class="panel-list">
            ${this._config.rows.length === 0
              ? html`<div class="empty">No rows yet. Add one below.</div>`
              : this._config.rows.map((row, ri) => this._renderRow(row, ri))}
          </div>
          <div class="actions-bar">
            <mwc-button outlined @click=${this._addRow}>
              <ha-icon icon="mdi:plus" style="margin-right: 4px;"></ha-icon>
              Add row
            </mwc-button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderRow(row: RowConfig, ri: number) {
    const total = this._config!.rows.length;
    const rowData = { justify: row.justify ?? "center" };
    return html`
      <ha-expansion-panel outlined>
        <div slot="header" class="row-header">
          <span class="header-title">
            Row ${ri + 1}
            <span class="muted">(${row.entities.length} ${row.entities.length === 1 ? "entity" : "entities"})</span>
          </span>
          <div class="row-actions" @click=${stop}>
            <ha-icon-button
              .disabled=${ri === 0}
              .label=${"Move up"}
              @click=${() => this._moveRow(ri, -1)}>
              <ha-icon icon="mdi:arrow-up"></ha-icon>
            </ha-icon-button>
            <ha-icon-button
              .disabled=${ri === total - 1}
              .label=${"Move down"}
              @click=${() => this._moveRow(ri, 1)}>
              <ha-icon icon="mdi:arrow-down"></ha-icon>
            </ha-icon-button>
            <ha-icon-button
              .label=${"Remove row"}
              @click=${() => this._removeRow(ri)}>
              <ha-icon icon="mdi:delete"></ha-icon>
            </ha-icon-button>
          </div>
        </div>
        <div class="row-content">
          <ha-form
            .hass=${this.hass}
            .data=${rowData}
            .schema=${ROW_SCHEMA}
            .computeLabel=${this._computeLabel}
            @value-changed=${(ev: CustomEvent) => this._handleRowChange(ri, ev)}
          ></ha-form>

          <div class="panel-list">
            ${row.entities.length === 0
              ? html`<div class="empty">No entities yet.</div>`
              : row.entities.map((ent, ei) => this._renderEntity(ent, ri, ei, row.entities.length))}
          </div>

          <div class="actions-bar">
            <mwc-button outlined @click=${() => this._addEntity(ri)}>
              <ha-icon icon="mdi:plus" style="margin-right: 4px;"></ha-icon>
              Add entity
            </mwc-button>
          </div>
        </div>
      </ha-expansion-panel>
    `;
  }

  private _renderEntity(ent: ControlConfig, ri: number, ei: number, total: number) {
    const schema = SCHEMAS_BY_TYPE[ent.type] ?? COMMON_ENTITY_FIELDS;
    return html`
      <ha-expansion-panel outlined>
        <div slot="header" class="entity-header">
          <span class="type-chip">${ent.type}</span>
          <span class="header-title">
            <span class="entity-id">${ent.entity ?? "(no entity)"}</span>
          </span>
          <div class="entity-actions" @click=${stop}>
            <ha-icon-button
              .disabled=${ei === 0}
              .label=${"Move left"}
              @click=${() => this._moveEntity(ri, ei, -1)}>
              <ha-icon icon="mdi:arrow-left"></ha-icon>
            </ha-icon-button>
            <ha-icon-button
              .disabled=${ei === total - 1}
              .label=${"Move right"}
              @click=${() => this._moveEntity(ri, ei, 1)}>
              <ha-icon icon="mdi:arrow-right"></ha-icon>
            </ha-icon-button>
            <ha-icon-button
              .label=${"Remove entity"}
              @click=${() => this._removeEntity(ri, ei)}>
              <ha-icon icon="mdi:delete"></ha-icon>
            </ha-icon-button>
          </div>
        </div>
        <div class="entity-content">
          <ha-form
            .hass=${this.hass}
            .data=${ent}
            .schema=${schema}
            .computeLabel=${this._computeLabel}
            .computeHelper=${this._computeHelper}
            @value-changed=${(ev: CustomEvent) => this._handleEntityChange(ri, ei, ev)}
          ></ha-form>
        </div>
      </ha-expansion-panel>
    `;
  }

  // -- event handlers -------------------------------------------------------

  private _computeLabel = (schema: { name?: string }): string => {
    const n = schema?.name;
    if (!n) return "";
    // Convert snake_case to "Title Case".
    return n
      .split("_")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  };

  private _computeHelper = (schema: { name?: string }): string => {
    if (schema?.name === "unit") {
      return "Leave unset to use the entity's unit of measurement; clear it to show no unit.";
    }
    return "";
  };

  private _handleCardChange = (ev: CustomEvent) => {
    if (!this._config) return;
    const incoming = ev.detail.value as Partial<RetroControlPanelCardConfig>;
    const merged: RetroControlPanelCardConfig = {
      ...this._config,
      ...incoming,
    };
    pruneEmpty(merged, ["title", "title_style"]);
    this._fireConfigChanged(merged);
  };

  private _handleRowChange = (ri: number, ev: CustomEvent) => {
    if (!this._config) return;
    const incoming = ev.detail.value as Partial<RowConfig>;
    const rows = this._config.rows.map((row, idx) => {
      if (idx !== ri) return row;
      const merged = { ...row, ...incoming } as RowConfig;
      // Drop the "center" justify - that's the implicit default.
      if (merged.justify === "center") delete (merged as Partial<RowConfig>).justify;
      return merged;
    });
    this._fireConfigChanged({ ...this._config, rows });
  };

  private _handleEntityChange = (ri: number, ei: number, ev: CustomEvent) => {
    if (!this._config) return;
    const incoming = ev.detail.value as ControlConfig;
    const oldEntity = this._config.rows[ri].entities[ei];

    // If the type changed, prune fields that don't apply to the new type so
    // we don't accumulate stale config keys when users swap control kinds.
    let next: ControlConfig = { ...incoming };
    if (incoming.type !== oldEntity.type) {
      const valid = VALID_KEYS_BY_TYPE[incoming.type] ?? new Set(["type", "entity"]);
      next = Object.fromEntries(
        Object.entries(next).filter(([k]) => valid.has(k)),
      ) as ControlConfig;
    }
    // Drop empties so the YAML stays clean.
    if (!next.entity) delete (next as { entity?: string }).entity;
    // Per-control label_style is no longer supported (always inherited from the
    // panel); strip any leftover so editing a control cleans up old configs.
    delete (next as { label_style?: string }).label_style;
    if ((next as { indicator?: string }).indicator === "") {
      delete (next as { indicator?: string }).indicator;
    }

    const rows = this._config.rows.map((row, idx) => {
      if (idx !== ri) return row;
      const entities = row.entities.map((e, eIdx) => (eIdx === ei ? next : e));
      return { ...row, entities };
    });
    this._fireConfigChanged({ ...this._config, rows });
  };

  private _addRow = () => {
    if (!this._config) return;
    const rows = [...this._config.rows, { entities: [] }];
    this._fireConfigChanged({ ...this._config, rows });
  };

  private _removeRow = (ri: number) => {
    if (!this._config) return;
    const rows = this._config.rows.filter((_, idx) => idx !== ri);
    this._fireConfigChanged({ ...this._config, rows });
  };

  private _moveRow = (ri: number, delta: number) => {
    if (!this._config) return;
    const target = ri + delta;
    if (target < 0 || target >= this._config.rows.length) return;
    const rows = [...this._config.rows];
    [rows[ri], rows[target]] = [rows[target], rows[ri]];
    this._fireConfigChanged({ ...this._config, rows });
  };

  private _addEntity = (ri: number) => {
    if (!this._config) return;
    const rows = this._config.rows.map((row, idx) => {
      if (idx !== ri) return row;
      const newEntity: ControlConfig = { type: "button" } as ControlConfig;
      return { ...row, entities: [...row.entities, newEntity] };
    });
    this._fireConfigChanged({ ...this._config, rows });
  };

  private _removeEntity = (ri: number, ei: number) => {
    if (!this._config) return;
    const rows = this._config.rows.map((row, idx) => {
      if (idx !== ri) return row;
      return { ...row, entities: row.entities.filter((_, eIdx) => eIdx !== ei) };
    });
    this._fireConfigChanged({ ...this._config, rows });
  };

  private _moveEntity = (ri: number, ei: number, delta: number) => {
    if (!this._config) return;
    const row = this._config.rows[ri];
    const target = ei + delta;
    if (target < 0 || target >= row.entities.length) return;
    const entities = [...row.entities];
    [entities[ei], entities[target]] = [entities[target], entities[ei]];
    const rows = this._config.rows.map((r, idx) => (idx === ri ? { ...r, entities } : r));
    this._fireConfigChanged({ ...this._config, rows });
  };

  private _fireConfigChanged(config: RetroControlPanelCardConfig) {
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

/** Click-handler shorthand: stop the bubble so the expansion panel header
    doesn't toggle when the user hits an action button next to it. */
function stop(e: Event) {
  e.stopPropagation();
}

/** Strip empty-string keys from an object so we don't write `title: ""` etc. */
function pruneEmpty(obj: Record<string, unknown>, keys: string[]): void {
  for (const k of keys) {
    if (obj[k] === "" || obj[k] === undefined) delete obj[k];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "retro-controlpanel-card-editor": RetroControlPanelCardEditor;
  }
}
