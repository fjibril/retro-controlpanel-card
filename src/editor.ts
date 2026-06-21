import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCardEditor } from "custom-card-helpers";
import type {
  ControlConfig,
  ControlType,
  GroupConfig,
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
 *
 * Entities can be nested arbitrarily deep via the `group` type (a control that
 * holds its own entities array). All entity handlers therefore work on a
 * `path: number[]` — the chain of indices from the top-level rows array down
 * to the target entity (e.g. `[2, 0, 1]` = `rows[2].entities[0].entities[1]`).
 */

// ---- option lists ---------------------------------------------------------

const TYPE_OPTIONS = [
  { value: "flip_switch",   label: "Flip switch" },
  { value: "button",        label: "Button" },
  { value: "seven_segment", label: "Seven-segment display" },
  { value: "vu_meter",      label: "VU meter" },
  { value: "gauge",         label: "Gauge" },
  { value: "group",         label: "Group" },
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

/** Dropdown options for fields that fall back to the panel default. */
const LABEL_STYLE_INHERIT_OPTIONS = [
  { value: "", label: "(inherit from panel)" },
  ...LABEL_STYLE_OPTIONS,
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

const GROUP_STYLE_OPTIONS = [
  { value: "none",     label: "None" },
  { value: "embossed", label: "Embossed bezel" },
  { value: "screwed",  label: "Screwed sub-panel" },
  { value: "stencil",  label: "Stencil corners" },
];

// ---- schemas --------------------------------------------------------------

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
  {
    type: "grid",
    name: "",
    schema: [
      { name: "justify",     selector: { select: { options: JUSTIFY_OPTIONS, mode: "dropdown" } } },
      { name: "group_style", selector: { select: { options: GROUP_STYLE_OPTIONS, mode: "dropdown" } } },
    ],
  },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "label",       selector: { text: {} } },
      { name: "label_style", selector: { select: { options: LABEL_STYLE_INHERIT_OPTIONS, mode: "dropdown" } } },
    ],
  },
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

/** Status-LED colour picker for the numeric controls (lit when active/heating). */
const INDICATOR_FIELD = {
  name: "indicator",
  selector: { select: { options: [{ value: "", label: "(none)" }, ...GLOW_COLOR_OPTIONS], mode: "dropdown" } },
};

/** Glow-colour picker for the tiny value LCD on VU meter / gauge. */
const VALUE_COLOR_FIELD = {
  name: "value_color",
  selector: { select: { options: [{ value: "", label: "(theme default)" }, ...GLOW_COLOR_OPTIONS], mode: "dropdown" } },
};

/** Control types that can read a numeric attribute + show a status LED. */
const NUMERIC_TYPES = new Set<ControlType>(["seven_segment", "vu_meter", "gauge"]);

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
    { name: "unit", selector: { text: {} } },
    { name: "leading_zeros", selector: { boolean: {} } },
    INDICATOR_FIELD,
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
    VALUE_COLOR_FIELD,
    INDICATOR_FIELD,
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
    VALUE_COLOR_FIELD,
    INDICATOR_FIELD,
    ...ACTION_FIELDS,
  ],
  // Groups don't have an entity / actions / unit - just the frame + label
  // controls. Their nested entities are managed by a separate list editor
  // below the ha-form (see _renderGroupChildren).
  group: [
    { name: "type", selector: { select: { options: TYPE_OPTIONS, mode: "dropdown" } } },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "group_style", selector: { select: { options: GROUP_STYLE_OPTIONS, mode: "dropdown" } } },
        { name: "label_style", selector: { select: { options: LABEL_STYLE_INHERIT_OPTIONS, mode: "dropdown" } } },
      ],
    },
    { name: "label", selector: { text: {} } },
  ],
};

/** Keys that may legally appear on each control type - used to prune stale
    fields when the user changes a control's type via the form. `width`/`height`
    are still allowed in YAML for power-users; `label_style` is intentionally
    omitted from the entity COMMON_KEYS - control label style is always
    inherited from the panel. Groups are different: they get their own
    label_style override (and don't have entity / actions / common fields). */
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
    "minimum_fraction_digits", "unit", "color", "attribute", "indicator",
  ]),
  vu_meter: new Set([
    ...COMMON_KEYS,
    "min", "max", "segments", "orientation",
    "green_threshold", "yellow_threshold",
    "show_scale", "scale_divisions", "show_value", "value_size", "value_color",
    "attribute", "indicator",
  ]),
  gauge: new Set([
    ...COMMON_KEYS,
    "min", "max", "unit", "major_ticks", "minor_ticks",
    "show_value", "value_size", "value_color",
    "attribute", "indicator",
  ]),
  group: new Set([
    "type", "group_style", "label", "label_style", "entities", "width", "height",
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
    .group-children {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 4px 0 0 0;
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
    const rowData = {
      justify: row.justify ?? "center",
      group_style: row.group_style ?? "none",
      label: row.label ?? "",
      label_style: row.label_style ?? "",
    };
    const headerTitle = row.label?.trim()
      ? row.label.trim()
      : `Row ${ri + 1}`;
    return html`
      <ha-expansion-panel outlined>
        <div slot="header" class="row-header">
          <span class="header-title">
            ${headerTitle}
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
            .computeHelper=${this._computeHelper}
            @value-changed=${(ev: CustomEvent) => this._handleRowChange(ri, ev)}
          ></ha-form>

          <div class="panel-list">
            ${row.entities.length === 0
              ? html`<div class="empty">No entities yet.</div>`
              : row.entities.map((ent, ei) =>
                  this._renderEntity(ent, [ri, ei], row.entities.length))}
          </div>

          <div class="actions-bar">
            <mwc-button outlined @click=${() => this._addEntity([ri])}>
              <ha-icon icon="mdi:plus" style="margin-right: 4px;"></ha-icon>
              Add entity
            </mwc-button>
          </div>
        </div>
      </ha-expansion-panel>
    `;
  }

  /**
   * Renders an entity (or a nested group) at the given path. `total` is the
   * count of siblings in the parent's entities array, used for disabling the
   * move-left/right buttons at the boundaries.
   */
  private _renderEntity(ent: ControlConfig, path: number[], total: number): TemplateResult {
    const ei = path[path.length - 1];
    const schema = this._entitySchema(ent);
    const isGroup = ent.type === "group";
    const headerSubtitle = isGroup
      ? ((ent as GroupConfig).label?.trim() || `${(ent as GroupConfig).entities?.length ?? 0} entities`)
      : (ent.entity ?? "(no entity)");
    return html`
      <ha-expansion-panel outlined>
        <div slot="header" class="entity-header">
          <span class="type-chip">${ent.type}</span>
          <span class="header-title">
            <span class="entity-id">${headerSubtitle}</span>
          </span>
          <div class="entity-actions" @click=${stop}>
            <ha-icon-button
              .disabled=${ei === 0}
              .label=${"Move left"}
              @click=${() => this._moveEntity(path, -1)}>
              <ha-icon icon="mdi:arrow-left"></ha-icon>
            </ha-icon-button>
            <ha-icon-button
              .disabled=${ei === total - 1}
              .label=${"Move right"}
              @click=${() => this._moveEntity(path, 1)}>
              <ha-icon icon="mdi:arrow-right"></ha-icon>
            </ha-icon-button>
            <ha-icon-button
              .label=${"Remove entity"}
              @click=${() => this._removeEntity(path)}>
              <ha-icon icon="mdi:delete"></ha-icon>
            </ha-icon-button>
          </div>
        </div>
        <div class="entity-content">
          <ha-form
            .hass=${this.hass}
            .data=${this._entityFormData(ent)}
            .schema=${schema}
            .computeLabel=${this._computeLabel}
            .computeHelper=${this._computeHelper}
            @value-changed=${(ev: CustomEvent) => this._handleEntityChange(path, ev)}
          ></ha-form>
          ${isGroup ? this._renderGroupChildren(ent as GroupConfig, path) : nothing}
        </div>
      </ha-expansion-panel>
    `;
  }

  /** Nested entities list + Add button inside a group's entity panel. */
  private _renderGroupChildren(group: GroupConfig, path: number[]): TemplateResult {
    const children = group.entities ?? [];
    return html`
      <div class="group-children">
        <div class="section-title" style="margin: 8px 0 0 0; font-size: 13px;">Group entities</div>
        <div class="panel-list">
          ${children.length === 0
            ? html`<div class="empty">No entities in this group.</div>`
            : children.map((sub, ei) =>
                this._renderEntity(sub, [...path, ei], children.length))}
        </div>
        <div class="actions-bar">
          <mwc-button outlined @click=${() => this._addEntity(path)}>
            <ha-icon icon="mdi:plus" style="margin-right: 4px;"></ha-icon>
            Add to group
          </mwc-button>
        </div>
      </div>
    `;
  }

  /**
   * Schema for a control's form. For numeric controls we inject an `attribute`
   * dropdown listing only the *numeric* attributes of the selected entity (so
   * a weather/climate entity's temperature/humidity show up, but the
   * sunny/cloudy condition or heat/off mode don't). Omitted when the entity
   * has no numeric attributes (plain sensors don't need it).
   */
  private _entitySchema(ent: ControlConfig): FormSchema {
    const base = SCHEMAS_BY_TYPE[ent.type] ?? COMMON_ENTITY_FIELDS;
    if (!NUMERIC_TYPES.has(ent.type)) return base;
    const opts = this._numericAttributeOptions(
      (ent as { entity?: string }).entity,
    );
    if (opts.length === 0) return base;
    const attrField = {
      name: "attribute",
      selector: {
        select: { options: [{ value: "", label: "(default value)" }, ...opts], mode: "dropdown" },
      },
    };
    // Insert right after the common type / entity / label rows.
    const out = [...base];
    out.splice(COMMON_ENTITY_FIELDS.length, 0, attrField);
    return out;
  }

  /**
   * ha-form binds to the data object by name; missing keys render as empty.
   * For groups, we also seed label_style to "" so the inherit option is
   * pre-selected rather than showing the first concrete option.
   */
  private _entityFormData(ent: ControlConfig): Record<string, unknown> {
    if (ent.type === "group") {
      const g = ent as GroupConfig;
      return {
        type: g.type,
        group_style: g.group_style ?? "none",
        label: g.label ?? "",
        label_style: g.label_style ?? "",
      };
    }
    return ent as unknown as Record<string, unknown>;
  }

  /** Numeric attributes of an entity, as select options. */
  private _numericAttributeOptions(entityId?: string): Array<{ value: string; label: string }> {
    if (!entityId || !this.hass) return [];
    const st = this.hass.states[entityId];
    if (!st) return [];
    const skip = new Set(["supported_features"]);
    return Object.entries(st.attributes ?? {})
      .filter(([k, v]) => typeof v === "number" && Number.isFinite(v) && !skip.has(k))
      .map(([k]) => ({ value: k, label: this._computeLabel({ name: k }) }));
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
    if (schema?.name === "label") {
      return "Leave empty to use the entity's name. Type a single space to hide the label entirely.";
    }
    if (schema?.name === "unit") {
      return "Leave empty to use the entity's unit of measurement, or type a custom one. Type a single space to show no unit at all.";
    }
    if (schema?.name === "group_style") {
      return "Decorative frame around this cluster's controls. Embossed = engraved outline; screwed = sub-panel with corner screws; stencil = painted L-brackets at the corners.";
    }
    if (schema?.name === "label_style") {
      return "How this label is rendered. Leave on 'inherit' to follow the panel's label style.";
    }
    if (schema?.name === "attribute") {
      return "Which numeric attribute to display. Default picks a sensible one (weather→temperature, climate→current temperature).";
    }
    if (schema?.name === "indicator") {
      return "Status LED beside the label - lit when the entity is active (for climate: heating).";
    }
    if (schema?.name === "value_color") {
      return "Glow colour of the small value readout (only shown when 'Show value' is on).";
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
      // Drop the implicit defaults so the YAML stays clean.
      if (merged.justify === "center") delete (merged as Partial<RowConfig>).justify;
      if (merged.group_style === "none") delete (merged as Partial<RowConfig>).group_style;
      // ha-form clears text fields to ""; treat that as "no label" (a single
      // space, by contrast, is the explicit "hide" sentinel - preserve it).
      if ((merged as { label?: string }).label === "") {
        delete (merged as Partial<RowConfig>).label;
      }
      if ((merged as { label_style?: string }).label_style === "") {
        delete (merged as Partial<RowConfig>).label_style;
      }
      return merged;
    });
    this._fireConfigChanged({ ...this._config, rows });
  };

  private _handleEntityChange = (path: number[], ev: CustomEvent) => {
    if (!this._config) return;
    const incoming = ev.detail.value as ControlConfig;
    const oldEntity = getEntityAt(this._config.rows, path);

    let next: ControlConfig = { ...incoming };
    // Type change: prune fields that don't apply to the new type so stale keys
    // don't pile up. Going TO a group also seeds the `entities` array.
    if (incoming.type !== oldEntity.type) {
      const valid = VALID_KEYS_BY_TYPE[incoming.type] ?? new Set(["type"]);
      next = Object.fromEntries(
        Object.entries(next).filter(([k]) => valid.has(k)),
      ) as ControlConfig;
      if (incoming.type === "group") {
        const g = next as GroupConfig;
        if (!Array.isArray(g.entities)) g.entities = [];
      }
    }
    // For groups, preserve the nested entities array (ha-form doesn't carry
    // it in the value, since it's not a schema field).
    if (next.type === "group" && oldEntity.type === "group") {
      (next as GroupConfig).entities = (oldEntity as GroupConfig).entities ?? [];
    }
    // Drop empties so the YAML stays clean.
    if (!(next as { entity?: string }).entity) {
      delete (next as { entity?: string }).entity;
    }
    // ha-form sends "" for the "(inherit)" choice on the label_style select;
    // strip it so we don't persist label_style: "" in the YAML.
    if ((next as { label_style?: string }).label_style === "") {
      delete (next as { label_style?: string }).label_style;
    }
    // Non-group entities never carry label_style (always inherited from the
    // panel); strip any leftover so editing a control cleans up old configs.
    if (next.type !== "group") {
      delete (next as { label_style?: string }).label_style;
    }
    if ((next as { indicator?: string }).indicator === "") {
      delete (next as { indicator?: string }).indicator;
    }
    if ((next as { attribute?: string }).attribute === "") {
      delete (next as { attribute?: string }).attribute;
    }
    if ((next as { value_color?: string }).value_color === "") {
      delete (next as { value_color?: string }).value_color;
    }
    if ((next as { group_style?: string }).group_style === "none") {
      delete (next as { group_style?: string }).group_style;
    }

    const parentPath = path.slice(0, -1);
    const ei = path[path.length - 1];
    const newRows = updateRowEntities(this._config.rows, parentPath, (entities) =>
      entities.map((e, idx) => (idx === ei ? next : e)),
    );
    this._fireConfigChanged({ ...this._config, rows: newRows });
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

  /**
   * Append a new entity at the given parent path. `parentPath = [ri]` appends
   * to row[ri].entities; `parentPath = [ri, ei]` appends to the group at that
   * position (deeper paths recurse through nested groups).
   */
  private _addEntity = (parentPath: number[]) => {
    if (!this._config) return;
    const newEntity: ControlConfig = { type: "button" } as ControlConfig;
    const newRows = updateRowEntities(
      this._config.rows,
      parentPath,
      (entities) => [...entities, newEntity],
    );
    this._fireConfigChanged({ ...this._config, rows: newRows });
  };

  private _removeEntity = (path: number[]) => {
    if (!this._config) return;
    const ei = path[path.length - 1];
    const parentPath = path.slice(0, -1);
    const newRows = updateRowEntities(this._config.rows, parentPath, (entities) =>
      entities.filter((_, idx) => idx !== ei),
    );
    this._fireConfigChanged({ ...this._config, rows: newRows });
  };

  private _moveEntity = (path: number[], delta: number) => {
    if (!this._config) return;
    const ei = path[path.length - 1];
    const parentPath = path.slice(0, -1);
    const newRows = updateRowEntities(this._config.rows, parentPath, (entities) => {
      const target = ei + delta;
      if (target < 0 || target >= entities.length) return entities;
      const next = [...entities];
      [next[ei], next[target]] = [next[target], next[ei]];
      return next;
    });
    this._fireConfigChanged({ ...this._config, rows: newRows });
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

/**
 * Resolve the entity at `path` in the rows tree. Path of length >= 2 is
 * required (path[0] is the row, subsequent indices descend through entities).
 */
function getEntityAt(rows: RowConfig[], path: number[]): ControlConfig {
  if (path.length < 2) {
    throw new Error(`entity path requires at least 2 indices, got ${path.length}`);
  }
  let target: ControlConfig | undefined;
  let entities: ControlConfig[] = rows[path[0]].entities;
  for (let i = 1; i < path.length; i++) {
    target = entities[path[i]];
    if (i < path.length - 1) {
      if (target.type !== "group") {
        throw new Error("path navigates into a non-group entity");
      }
      entities = (target as GroupConfig).entities;
    }
  }
  return target!;
}

/**
 * Immutably update the entities array at `parentPath` via `fn`. Parent path
 * `[ri]` targets a row's entities; `[ri, ei]` targets a group's entities at
 * that position; longer paths descend through nested groups.
 */
function updateRowEntities(
  rows: RowConfig[],
  parentPath: number[],
  fn: (entities: ControlConfig[]) => ControlConfig[],
): RowConfig[] {
  if (parentPath.length === 0) {
    throw new Error("parent path requires at least the row index");
  }
  return rows.map((row, ri) => {
    if (ri !== parentPath[0]) return row;
    if (parentPath.length === 1) {
      return { ...row, entities: fn(row.entities) };
    }
    return { ...row, entities: updateInGroup(row.entities, parentPath.slice(1), fn) };
  });
}

function updateInGroup(
  entities: ControlConfig[],
  parentPath: number[],
  fn: (entities: ControlConfig[]) => ControlConfig[],
): ControlConfig[] {
  const head = parentPath[0];
  const rest = parentPath.slice(1);
  return entities.map((ent, idx) => {
    if (idx !== head) return ent;
    if (ent.type !== "group") {
      throw new Error("path navigates into a non-group entity");
    }
    const group = ent as GroupConfig;
    const innerEntities = group.entities ?? [];
    if (rest.length === 0) {
      return { ...group, entities: fn(innerEntities) };
    }
    return { ...group, entities: updateInGroup(innerEntities, rest, fn) };
  });
}

declare global {
  interface HTMLElementTagNameMap {
    "retro-controlpanel-card-editor": RetroControlPanelCardEditor;
  }
}
