import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCardEditor } from "custom-card-helpers";
import type {
  ColorRule,
  ControlConfig,
  ControlType,
  GlowColor,
  GroupConfig,
  RetroControlPanelCardConfig,
  RowConfig,
  SevenSegmentConfig,
  TableCellConfig,
  TableCellOptions,
  TableCellType,
  TableColumnConfig,
  TableConfig,
  TableRowConfig,
} from "./types.js";
import { isTimeMode, parseIsoInstant, parsePlainTime } from "./controls/time-format.js";

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
  { value: "table",         label: "Table" },
];

/** What a table's cells can be: every control that shows one entity. */
const CELL_TYPE_OPTIONS = TYPE_OPTIONS.filter((o) => o.value !== "group" && o.value !== "table");
const CELL_TYPES = CELL_TYPE_OPTIONS.map((o) => o.value as TableCellType);
const isCellType = (v: unknown): v is TableCellType => CELL_TYPES.includes(v as TableCellType);

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

const DISPLAY_MODE_OPTIONS = [
  { value: "number",    label: "Number" },
  { value: "time",      label: "Time (clock when no entity)" },
  { value: "countdown", label: "Countdown / time since" },
];

const GROUP_STYLE_OPTIONS = [
  { value: "none",     label: "None" },
  { value: "embossed", label: "Embossed bezel" },
  { value: "screwed",  label: "Screwed sub-panel" },
  { value: "stencil",  label: "Stencil corners" },
];

// ---- schemas --------------------------------------------------------------

type FormSchema = readonly unknown[];

/** Size multiplier slider, shared by the panel, rows and groups. */
const SCALE_FIELD = {
  name: "scale",
  selector: { number: { min: 0.5, max: 2, step: 0.05, mode: "slider" } },
};

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
      SCALE_FIELD,
    ],
  },
];

/** A frame that stretches rather than hugging its controls; rows and groups. */
const FILL_WIDTH_FIELD = { name: "fill_width", selector: { boolean: {} } };

/** A top-level row's settings, folded away above its entities. */
const ROW_SCHEMA: FormSchema = [
  {
    type: "expandable",
    name: "",
    flatten: true,
    title: "Settings for this row",
    schema: [
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
      { type: "grid", name: "", schema: [SCALE_FIELD, FILL_WIDTH_FIELD] },
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

/** Seven-segment display mode + seconds toggle. The attribute dropdown is inserted after it. */
const SEVEN_SEGMENT_MODE_ROW = {
  type: "grid",
  name: "",
  schema: [
    { name: "display_mode", selector: { select: { options: DISPLAY_MODE_OPTIONS, mode: "dropdown" } } },
    { name: "show_seconds", selector: { boolean: {} } },
  ],
};

/** One conditional colour of a seven-segment display (see _renderColorRules). */
const COLOR_RULE_SCHEMA: FormSchema = [
  { name: "color",  selector: { select: { options: GLOW_COLOR_OPTIONS, mode: "dropdown" } } },
  { name: "entity", selector: { entity: {} } },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "above", selector: { number: { mode: "box", step: "any" } } },
      { name: "below", selector: { number: { mode: "box", step: "any" } } },
    ],
  },
];

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
    SEVEN_SEGMENT_MODE_ROW,
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
    { type: "grid", name: "", schema: [SCALE_FIELD, FILL_WIDTH_FIELD] },
  ],
  // Columns and rows have their own list editors below the form (see
  // _renderTableEditor); the form itself holds the cell type and the size.
  table: [
    { name: "type",      selector: { select: { options: TYPE_OPTIONS, mode: "dropdown" } } },
    { name: "cell_type", selector: { select: { options: CELL_TYPE_OPTIONS, mode: "dropdown" } } },
    SCALE_FIELD,
    { name: "equal_columns", selector: { boolean: {} } },
  ],
};

/** Which layer of a table a settings form edits; a row's settings win over its columns'. */
type TableLayer = "column" | "row";

type SelectOption = { value: string; label: string };
type SchemaField = {
  name?: string;
  type?: string;
  schema?: FormSchema;
  selector?: { select?: { options: SelectOption[] } };
};

/**
 * What a column's dropdown shows when the column leaves it unset: the
 * control's own default. Colour and LED pickers show their "unset" choice.
 * VU meters lie down in a table (see retro-table's CELL_DEFAULTS).
 */
const COLUMN_SELECT_DEFAULTS: Record<string, string> = {
  display_mode: "number",
  orientation: "horizontal",
  indicator_position: "right",
};

/**
 * The settings a table column or row gives its cells: the cell type's own
 * form fields, without what the table decides (type, entity, label). The
 * attribute is typed in, as there is no single entity to list attributes
 * from, and the actions fold away.
 *
 * Dropdowns get an explicit "unset" choice where unset means something other
 * than a value the list already has: the theme colour (or no LED) for a
 * column, and for a row on every dropdown, the column's setting.
 */
function tableSettingsSchema(type: TableCellType, layer: TableLayer): FormSchema {
  const optional = (field: unknown): unknown => {
    const f = field as SchemaField;
    if (f.type === "grid" && f.schema) return { ...f, schema: f.schema.map(optional) };
    const select = f.selector?.select;
    if (!select || (layer === "column" && (f.name ?? "") in COLUMN_SELECT_DEFAULTS)) return field;
    const unset = layer === "row" ? "(column's)" : f.name === "indicator" ? "(none)" : "(theme default)";
    const choices = select.options.filter((o) => o.value !== "");
    return { ...f, selector: { select: { ...select, options: [{ value: "", label: unset }, ...choices] } } };
  };
  const own = SCHEMAS_BY_TYPE[type]
    .filter((f) => !COMMON_ENTITY_FIELDS.includes(f) && !ACTION_FIELDS.includes(f))
    .map(optional);
  return [
    ...own,
    ...(NUMERIC_TYPES.has(type) ? [{ name: "attribute", selector: { text: {} } }] : []),
    { type: "expandable", name: "", flatten: true, title: "Actions", schema: ACTION_FIELDS },
  ];
}

function perCellType<T>(make: (type: TableCellType) => T): Record<TableCellType, T> {
  return Object.fromEntries(CELL_TYPES.map((t) => [t, make(t)])) as Record<TableCellType, T>;
}

const TABLE_SETTINGS: Record<TableLayer, Record<TableCellType, FormSchema>> = {
  column: perCellType((t) => tableSettingsSchema(t, "column")),
  row: perCellType((t) => tableSettingsSchema(t, "row")),
};

/** One table column: its header and group, then defaults for every cell in it, folded away. */
const TABLE_COLUMN_SCHEMAS = perCellType((t): FormSchema => [
  {
    type: "grid",
    name: "",
    schema: [
      { name: "header", selector: { text: {} } },
      { name: "group", selector: { text: {} } },
    ],
  },
  {
    type: "expandable",
    name: "",
    flatten: true,
    title: "Settings for this column",
    schema: TABLE_SETTINGS.column[t],
  },
]);

/** A table row's settings, folded away under its entities. */
const TABLE_ROW_SETTINGS = perCellType((t) => ({
  type: "expandable",
  name: "",
  flatten: true,
  title: "Settings for this row",
  schema: TABLE_SETTINGS.row[t],
}));

/** Names of the dropdowns in a schema, grids and folding sections included. */
function selectFieldNames(schema: FormSchema): string[] {
  return schema.flatMap((field) => {
    const f = field as SchemaField;
    if (f.schema) return selectFieldNames(f.schema);
    return f.selector?.select && f.name ? [f.name] : [];
  });
}

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
    "display_mode", "show_seconds", "color_rules",
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
    "type", "group_style", "label", "label_style", "scale", "fill_width", "entities", "width", "height",
  ]),
  table: new Set(["type", "cell_type", "scale", "equal_columns", "columns", "rows"]),
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
    .rule-box {
      border: 1px solid var(--divider-color);
      border-radius: 6px;
      padding: 0 8px 8px 12px;
    }
    .rules-hint {
      font-size: 12px;
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
      scale: row.scale ?? 1,
      fill_width: row.fill_width ?? false,
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
      : ent.type === "table"
        ? `${cellTypeLabel(ent)}, ${ent.rows?.length ?? 0} rows × ${tableColumnCount(ent)} columns`
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
          ${ent.type === "seven_segment" ? this._renderColorRules(ent, path) : nothing}
          ${ent.type === "table" ? this._renderTableEditor(ent, path) : nothing}
        </div>
      </ha-expansion-panel>
    `;
  }

  /**
   * Conditional colours of a seven-segment display: an ordered list (the first
   * matching rule wins), each rule its own small form with move / remove
   * buttons.
   */
  private _renderColorRules(ent: SevenSegmentConfig, path: number[]): TemplateResult {
    const rules = ent.color_rules ?? [];
    return html`
      <div class="group-children">
        <div class="section-title" style="margin: 8px 0 0 0; font-size: 13px;">Color rules</div>
        <div class="muted rules-hint">
          The first matching rule sets the color; if none match, the color above applies.
          Times count as minutes until the timestamp, negative once it has passed.
        </div>
        <div class="panel-list">
          ${rules.map((rule, ri) => html`
            <div class="rule-box">
              <div class="entity-header">
                <span class="header-title">Rule ${ri + 1}</span>
                <div class="entity-actions">
                  <ha-icon-button
                    .disabled=${ri === 0}
                    .label=${"Move up"}
                    @click=${() => this._moveRule(path, ri, -1)}>
                    <ha-icon icon="mdi:arrow-up"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button
                    .disabled=${ri === rules.length - 1}
                    .label=${"Move down"}
                    @click=${() => this._moveRule(path, ri, 1)}>
                    <ha-icon icon="mdi:arrow-down"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button
                    .label=${"Remove rule"}
                    @click=${() => this._removeRule(path, ri)}>
                    <ha-icon icon="mdi:delete"></ha-icon>
                  </ha-icon-button>
                </div>
              </div>
              <ha-form
                .hass=${this.hass}
                .data=${rule}
                .schema=${COLOR_RULE_SCHEMA}
                .computeLabel=${this._computeLabel}
                .computeHelper=${this._computeRuleHelper}
                @value-changed=${(ev: CustomEvent) => this._handleRuleChange(path, ri, ev)}
              ></ha-form>
            </div>
          `)}
        </div>
        <div class="actions-bar">
          <mwc-button outlined @click=${() => this._addRule(path)}>
            <ha-icon icon="mdi:plus" style="margin-right: 4px;"></ha-icon>
            Add color rule
          </mwc-button>
        </div>
      </div>
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
   * sunny/cloudy condition or heat/off mode don't). A seven-segment display in
   * a time mode lists the attributes holding a time instead (e.g. the sun's
   * next_rising). Omitted when the entity has no matching attributes.
   */
  private _entitySchema(ent: ControlConfig): FormSchema {
    const base = SCHEMAS_BY_TYPE[ent.type] ?? COMMON_ENTITY_FIELDS;
    if (!NUMERIC_TYPES.has(ent.type)) return base;
    const entityId = (ent as { entity?: string }).entity;
    const timeMode = ent.type === "seven_segment" && isTimeMode((ent as SevenSegmentConfig).display_mode);
    const opts = timeMode
      ? this._timeAttributeOptions(entityId)
      : this._numericAttributeOptions(entityId);
    if (opts.length === 0) return base;
    const attrField = {
      name: "attribute",
      selector: {
        select: {
          options: [{ value: "", label: timeMode ? "(state)" : "(default value)" }, ...opts],
          mode: "dropdown",
        },
      },
    };
    // After the mode row when there is one (the options depend on it),
    // otherwise right after the common type / entity / label rows.
    const modeRow = base.indexOf(SEVEN_SEGMENT_MODE_ROW);
    const out = [...base];
    out.splice(modeRow >= 0 ? modeRow + 1 : COMMON_ENTITY_FIELDS.length, 0, attrField);
    return out;
  }

  /**
   * ha-form binds to the data object by name; missing keys render as empty.
   * For groups, we also seed label_style to "" so the inherit option is
   * pre-selected rather than showing the first concrete option. The rest of
   * the group is spread in so keys without a form field (width / height)
   * survive an edit.
   */
  private _entityFormData(ent: ControlConfig): Record<string, unknown> {
    if (ent.type === "group") {
      const g = ent as GroupConfig;
      return {
        ...g,
        group_style: g.group_style ?? "none",
        label: g.label ?? "",
        label_style: g.label_style ?? "",
        scale: g.scale ?? 1,
        fill_width: g.fill_width ?? false,
      };
    }
    if (ent.type === "seven_segment") {
      // Show the implicit default rather than a blank dropdown.
      return { ...ent, display_mode: ent.display_mode ?? "number" };
    }
    if (ent.type === "table") {
      return { ...ent, cell_type: ent.cell_type ?? "seven_segment", scale: ent.scale ?? 1 };
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

  /** Attributes of an entity holding a timestamp or HH:MM time, as select options. */
  private _timeAttributeOptions(entityId?: string): Array<{ value: string; label: string }> {
    if (!entityId || !this.hass) return [];
    const st = this.hass.states[entityId];
    if (!st) return [];
    return Object.entries(st.attributes ?? {})
      .filter(([, v]) => parseIsoInstant(v) !== null || parsePlainTime(v) !== null)
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
    if (schema?.name === "fill_width") {
      return "Stretch the frame rather than hugging the controls: a row across the whole panel, a group into the rest of its line (shared with other groups that fill).";
    }
    if (schema?.name === "scale") {
      return "Size relative to the surrounding panel or row (1 = same size).";
    }
    if (schema?.name === "label_style") {
      return "How this label is rendered. Leave on 'inherit' to follow the panel's label style.";
    }
    if (schema?.name === "attribute") {
      return "Which attribute to display instead of the state. For numbers the default picks a sensible one (weather→temperature, climate→current temperature); for times, pick one holding a timestamp.";
    }
    if (schema?.name === "display_mode") {
      return "Number shows the value. Time shows a timestamp as HH:MM - leave Entity empty for a live clock. Countdown shows the time left until the timestamp, then '-' and the time since once it has passed. Digits, fraction digits and leading zeros only apply to Number.";
    }
    if (schema?.name === "show_seconds") {
      return "Time and Countdown only: add seconds (HH:MM:SS). Ticks locally in the browser - no extra Home Assistant traffic.";
    }
    if (schema?.name === "indicator") {
      return "Status LED beside the label - lit when the entity is active (for climate: heating).";
    }
    if (schema?.name === "value_color") {
      return "Glow colour of the small value readout (only shown when 'Show value' is on).";
    }
    if (schema?.name === "cell_type") {
      return "What the cells are. In YAML a column, row or cell can set its own type.";
    }
    if (schema?.name === "equal_columns") {
      return "Make every column as wide as the widest one.";
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
      if (merged.scale === 1) delete (merged as Partial<RowConfig>).scale;
      if (merged.fill_width === false) delete (merged as Partial<RowConfig>).fill_width;
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
      if (incoming.type === "table") {
        const t = next as TableConfig;
        if (!Array.isArray(t.rows)) t.rows = [];
      }
    }
    // For groups, preserve the nested entities array (ha-form doesn't carry
    // it in the value, since it's not a schema field).
    if (next.type === "group" && oldEntity.type === "group") {
      (next as GroupConfig).entities = (oldEntity as GroupConfig).entities ?? [];
    }
    // Same for a table's rows and columns, which have their own editors. A new
    // cell type drops the column, row and cell settings it doesn't have.
    if (next.type === "table" && oldEntity.type === "table") {
      next.rows = oldEntity.rows ?? [];
      if (oldEntity.columns) next.columns = oldEntity.columns;
      else delete next.columns;
      const cellType = next.cell_type ?? "seven_segment";
      if (cellType !== (oldEntity.cell_type ?? "seven_segment")) next = retypeTable(next, cellType);
    }
    if (next.type === "table" && next.cell_type === "seven_segment") delete next.cell_type;
    if (next.type === "table" && next.equal_columns === false) delete next.equal_columns;
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
    if ((next.type === "group" || next.type === "table") && next.scale === 1) delete next.scale;
    if (next.type === "group" && next.fill_width === false) delete next.fill_width;
    if (next.type === "seven_segment") {
      const seg = next as SevenSegmentConfig;
      // An attribute picked for numbers means nothing for times (and vice
      // versa), so switching between number and time modes drops it.
      const oldMode = oldEntity.type === "seven_segment" ? (oldEntity as SevenSegmentConfig).display_mode : undefined;
      if (isTimeMode(seg.display_mode) !== isTimeMode(oldMode)) delete seg.attribute;
      if (seg.display_mode === "number") delete seg.display_mode;
      if (seg.show_seconds === false) delete seg.show_seconds;
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

  // -- colour rules (seven-segment) ------------------------------------------

  private _computeRuleHelper = (schema: { name?: string }): string => {
    if (schema?.name === "entity") {
      return "Optional. Test this entity instead of the display's own value.";
    }
    if (schema?.name === "above") {
      return "Matches when the value is greater than this.";
    }
    if (schema?.name === "below") {
      return "Matches when the value is less than this. For a time, 0 means it has passed.";
    }
    return "";
  };

  private _rulesAt(path: number[]): ColorRule[] {
    const ent = getEntityAt(this._config!.rows, path) as SevenSegmentConfig;
    return ent.color_rules ?? [];
  }

  /** Replace the entity at `path` with what `patch` makes of it. */
  private _patchEntity(path: number[], patch: (ent: ControlConfig) => ControlConfig): void {
    if (!this._config) return;
    const ei = path[path.length - 1];
    const newRows = updateRowEntities(this._config.rows, path.slice(0, -1), (entities) =>
      entities.map((e, idx) => (idx === ei ? patch(e) : e)),
    );
    this._fireConfigChanged({ ...this._config, rows: newRows });
  }

  /** Replace the rule list of the display at `path`; an empty list removes the key. */
  private _setRules(path: number[], rules: ColorRule[]): void {
    this._patchEntity(path, (e) => {
      const next = { ...e } as SevenSegmentConfig;
      if (rules.length > 0) next.color_rules = rules;
      else delete next.color_rules;
      return next;
    });
  }

  private _addRule = (path: number[]) => {
    if (!this._config) return;
    this._setRules(path, [...this._rulesAt(path), { color: "red" }]);
  };

  private _removeRule = (path: number[], ri: number) => {
    if (!this._config) return;
    this._setRules(path, this._rulesAt(path).filter((_, idx) => idx !== ri));
  };

  private _moveRule = (path: number[], ri: number, delta: number) => {
    if (!this._config) return;
    const rules = [...this._rulesAt(path)];
    const target = ri + delta;
    if (target < 0 || target >= rules.length) return;
    [rules[ri], rules[target]] = [rules[target], rules[ri]];
    this._setRules(path, rules);
  };

  private _handleRuleChange = (path: number[], ri: number, ev: CustomEvent) => {
    if (!this._config) return;
    const value = ev.detail.value as Record<string, unknown>;
    // Rebuild the rule from scratch so cleared fields don't linger as "" / null.
    const rule: ColorRule = { color: (value.color as GlowColor) || "red" };
    if (typeof value.entity === "string" && value.entity) rule.entity = value.entity;
    if (typeof value.above === "number" && Number.isFinite(value.above)) rule.above = value.above;
    if (typeof value.below === "number" && Number.isFinite(value.below)) rule.below = value.below;
    this._setRules(path, this._rulesAt(path).map((r, idx) => (idx === ri ? rule : r)));
  };

  // -- table ------------------------------------------------------------------

  /**
   * Columns (header + defaults for their cells) and rows (a label, one entity
   * per column, and settings of their own) of a table, each an ordered list
   * with move / remove buttons. The settings are those of the table's cell
   * type. Per-cell overrides stay in YAML; editing a row keeps them.
   */
  private _renderTableEditor(t: TableConfig, path: number[]): TemplateResult {
    const type = isCellType(t.cell_type) ? t.cell_type : "seven_segment";
    const count = tableColumnCount(t);
    const columns = paddedColumns(t, count);
    const rows = t.rows ?? [];
    const rowLabel = (schema: { name?: string }) => {
      const m = /^cell_(\d+)$/.exec(schema?.name ?? "");
      if (!m) return this._computeLabel(schema);
      const i = Number(m[1]);
      return columns[i]?.header?.trim() || `Column ${i + 1}`;
    };
    // A column or row can set its own type in YAML; its settings form then
    // shows that type's fields, and its title names the type.
    const ownType = (o: { type?: TableCellType }) => (isCellType(o.type) ? o.type : type);
    const typeNote = (o: { type?: TableCellType }) =>
      isCellType(o.type) ? ` · ${CELL_TYPE_OPTIONS.find((opt) => opt.value === o.type)?.label}` : "";
    const helper = (t: TableCellType, layer: TableLayer) => (schema: { name?: string }) =>
      this._tableHelper(schema, t, layer);
    return html`
      <div class="group-children">
        <div class="section-title" style="margin: 8px 0 0 0; font-size: 13px;">Columns</div>
        <div class="muted rules-hint">Settings here apply to every cell in the column.</div>
        <div class="panel-list">
          ${columns.map((col, ci) => html`
            <div class="rule-box">
              <div class="entity-header">
                <span class="header-title">Column ${ci + 1}${typeNote(col)}</span>
                <div class="entity-actions">
                  <ha-icon-button
                    .disabled=${ci === 0}
                    .label=${"Move left"}
                    @click=${() => this._moveTableColumn(path, ci, -1)}>
                    <ha-icon icon="mdi:arrow-left"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button
                    .disabled=${ci === count - 1}
                    .label=${"Move right"}
                    @click=${() => this._moveTableColumn(path, ci, 1)}>
                    <ha-icon icon="mdi:arrow-right"></ha-icon>
                  </ha-icon-button>
                  <ha-icon-button
                    .label=${"Remove column"}
                    @click=${() => this._removeTableColumn(path, ci)}>
                    <ha-icon icon="mdi:delete"></ha-icon>
                  </ha-icon-button>
                </div>
              </div>
              <ha-form
                .hass=${this.hass}
                .data=${tableSettingsFormData(col, ownType(col), "column")}
                .schema=${TABLE_COLUMN_SCHEMAS[ownType(col)]}
                .computeLabel=${this._computeLabel}
                .computeHelper=${helper(ownType(col), "column")}
                @value-changed=${(ev: CustomEvent) => this._handleTableColumnChange(path, ci, ev)}
              ></ha-form>
            </div>
          `)}
        </div>
        <div class="actions-bar">
          <mwc-button outlined @click=${() => this._addTableColumn(path)}>
            <ha-icon icon="mdi:plus" style="margin-right: 4px;"></ha-icon>
            Add column
          </mwc-button>
        </div>

        <div class="section-title" style="margin: 8px 0 0 0; font-size: 13px;">Rows</div>
        <div class="muted rules-hint">
          A row's settings win over its columns'. Leave a setting empty to use the column's.
        </div>
        <div class="panel-list">
          ${rows.length === 0
            ? html`<div class="empty">No rows yet.</div>`
            : rows.map((row, ri) => html`
                <div class="rule-box">
                  <div class="entity-header">
                    <span class="header-title">${row.label?.trim() || `Row ${ri + 1}`}${typeNote(row)}</span>
                    <div class="entity-actions">
                      <ha-icon-button
                        .disabled=${ri === 0}
                        .label=${"Move up"}
                        @click=${() => this._moveTableRow(path, ri, -1)}>
                        <ha-icon icon="mdi:arrow-up"></ha-icon>
                      </ha-icon-button>
                      <ha-icon-button
                        .disabled=${ri === rows.length - 1}
                        .label=${"Move down"}
                        @click=${() => this._moveTableRow(path, ri, 1)}>
                        <ha-icon icon="mdi:arrow-down"></ha-icon>
                      </ha-icon-button>
                      <ha-icon-button
                        .label=${"Remove row"}
                        @click=${() => this._removeTableRow(path, ri)}>
                        <ha-icon icon="mdi:delete"></ha-icon>
                      </ha-icon-button>
                    </div>
                  </div>
                  <ha-form
                    .hass=${this.hass}
                    .data=${tableRowFormData(row, count, ownType(row))}
                    .schema=${tableRowSchema(count, ownType(row))}
                    .computeLabel=${rowLabel}
                    .computeHelper=${helper(ownType(row), "row")}
                    @value-changed=${(ev: CustomEvent) => this._handleTableRowChange(path, ri, count, ev)}
                  ></ha-form>
                </div>
              `)}
        </div>
        <div class="actions-bar">
          <mwc-button outlined @click=${() => this._addTableRow(path)}>
            <ha-icon icon="mdi:plus" style="margin-right: 4px;"></ha-icon>
            Add row
          </mwc-button>
        </div>
        <div class="muted rules-hint">
          Settings for a single cell, and color rules, go in YAML: write the cell as an
          object with its entity and settings instead of an entity id. So does a different
          type for a column, row or cell (e.g. type: button).
        </div>
      </div>
    `;
  }

  /** Helper texts for a table's column and row forms, where they differ from a control's. */
  private _tableHelper(schema: { name?: string }, type: TableCellType, layer: TableLayer): string {
    switch (schema?.name) {
      case "header":
        return "Usually the unit, e.g. °C. Keeps its case.";
      case "group":
        return layer === "column"
          ? "E.g. a room. Neighbouring columns with the same group share one heading."
          : "E.g. a room. Neighbouring rows with the same group share one name, left of a bracket.";
      case "label":
        return "Shown left of the row.";
      case "unit":
        return type === "seven_segment"
          ? "Shown beside each value. Leave empty to show none, since the header names the unit."
          : "Printed on the dial. Leave empty for the entity's unit; a single space shows none.";
      case "display_mode":
        return "Number, a timestamp as HH:MM, or a countdown - as for a seven-segment display.";
      case "attribute":
        return "Show this attribute instead of the state, e.g. current_temperature or hvac_action.";
      case "orientation":
        return "In a table a VU meter lies down unless you set it upright.";
      default:
        return this._computeHelper(schema);
    }
  }

  private _patchTable(path: number[], patch: (t: TableConfig) => TableConfig): void {
    this._patchEntity(path, (e) => patch(e as TableConfig));
  }

  private _addTableColumn = (path: number[]) => {
    this._patchTable(path, (t) => ({ ...t, columns: [...paddedColumns(t, tableColumnCount(t)), {}] }));
  };

  /** Removing a column also removes its cell from every row, so rows stay aligned. */
  private _removeTableColumn = (path: number[], ci: number) => {
    this._patchTable(path, (t) => ({
      ...t,
      columns: paddedColumns(t, tableColumnCount(t)).filter((_, i) => i !== ci),
      rows: (t.rows ?? []).map((r) => ({ ...r, cells: trimCells((r.cells ?? []).filter((_, i) => i !== ci)) })),
    }));
  };

  /** Moving a column moves its cells along with it. */
  private _moveTableColumn = (path: number[], ci: number, delta: number) => {
    this._patchTable(path, (t) => {
      const count = tableColumnCount(t);
      const target = ci + delta;
      if (target < 0 || target >= count) return t;
      const swap = <T,>(list: T[]): T[] => {
        const next = [...list];
        [next[ci], next[target]] = [next[target], next[ci]];
        return next;
      };
      return {
        ...t,
        columns: swap(paddedColumns(t, count)),
        rows: (t.rows ?? []).map((r) => {
          const cells = Array.from({ length: count }, (_, i) => r.cells?.[i] ?? null);
          return { ...r, cells: trimCells(swap(cells)) };
        }),
      };
    });
  };

  private _handleTableColumnChange = (path: number[], ci: number, ev: CustomEvent) => {
    const value = ev.detail.value as Record<string, unknown>;
    this._patchTable(path, (t) => {
      const columns = paddedColumns(t, tableColumnCount(t));
      // Start from the stored column so settings without a field (e.g. color
      // rules written in YAML) survive, then drop cleared fields.
      const col = { ...columns[ci], ...value } as Record<string, unknown>;
      pruneCellSettings(col, "column");
      columns[ci] = col as TableColumnConfig;
      return { ...t, columns };
    });
  };

  private _addTableRow = (path: number[]) => {
    this._patchTable(path, (t) => ({ ...t, rows: [...(t.rows ?? []), { cells: [] }] }));
  };

  private _removeTableRow = (path: number[], ri: number) => {
    this._patchTable(path, (t) => ({ ...t, rows: (t.rows ?? []).filter((_, i) => i !== ri) }));
  };

  private _moveTableRow = (path: number[], ri: number, delta: number) => {
    this._patchTable(path, (t) => {
      const rows = [...(t.rows ?? [])];
      const target = ri + delta;
      if (target < 0 || target >= rows.length) return t;
      [rows[ri], rows[target]] = [rows[target], rows[ri]];
      return { ...t, rows };
    });
  };

  private _handleTableRowChange = (path: number[], ri: number, count: number, ev: CustomEvent) => {
    const value = ev.detail.value as Record<string, unknown>;
    this._patchTable(path, (t) => {
      const rows = [...(t.rows ?? [])];
      const old = rows[ri] ?? { cells: [] };
      const cells = Array.from({ length: count }, (_, i): string | TableCellConfig | null => {
        const entity = value[`cell_${i}`];
        const prev = old.cells?.[i];
        if (typeof entity !== "string" || !entity) return null;
        // Keep a cell's own settings; only its entity changes here.
        return prev && typeof prev === "object" ? { ...prev, entity } : entity;
      });
      // The rest of the form is the label and the row's settings. Start from
      // the stored row so settings without a field survive.
      const settings = Object.fromEntries(
        Object.entries(value).filter(([k]) => !/^cell_\d+$/.test(k)),
      );
      const row = { ...old, ...settings } as Record<string, unknown>;
      pruneCellSettings(row, "row");
      row.cells = trimCells(cells);
      rows[ri] = row as unknown as TableRowConfig;
      return { ...t, rows };
    });
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

/** Columns a table has: those declared, or as many as its widest row. */
function tableColumnCount(t: TableConfig): number {
  return Math.max(
    t.columns?.length ?? 0,
    ...(t.rows ?? []).map((r) => (Array.isArray(r?.cells) ? r.cells.length : 0)),
    1,
  );
}

/** A table's columns, padded with empty ones up to `count`. */
function paddedColumns(t: TableConfig, count: number): TableColumnConfig[] {
  return Array.from({ length: count }, (_, i) => t.columns?.[i] ?? {});
}

/** Drop trailing empty cells so the YAML doesn't fill up with nulls. */
function trimCells(cells: Array<string | TableCellConfig | null | undefined>): Array<string | TableCellConfig | null> {
  const out = cells.map((c) => c ?? null);
  while (out.length > 0 && (out[out.length - 1] === null || out[out.length - 1] === "")) out.pop();
  return out;
}

/** The name of a table's cell type, for its panel header. */
function cellTypeLabel(t: TableConfig): string {
  const type = t.cell_type ?? "seven_segment";
  return CELL_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

/**
 * A column's or row's settings as form data. A dropdown it leaves unset shows
 * what that means: for a column the control's default (or "theme default" /
 * "none"), for a row the "column's" choice.
 */
function tableSettingsFormData(
  settings: TableCellOptions,
  type: TableCellType,
  layer: TableLayer,
): Record<string, unknown> {
  const data: Record<string, unknown> = { ...settings };
  for (const name of selectFieldNames(TABLE_SETTINGS[layer][type])) {
    if (data[name] === undefined) data[name] = layer === "column" ? (COLUMN_SELECT_DEFAULTS[name] ?? "") : "";
  }
  return data;
}

/** Boolean settings that are off unless set. */
const OFF_BY_DEFAULT = ["show_seconds", "leading_zeros", "show_scale", "show_value"];

/**
 * Drop cleared fields from a column's or row's settings. A column also drops
 * values that are the default anyway. A row keeps them: there they override
 * a column that says otherwise.
 */
function pruneCellSettings(settings: Record<string, unknown>, layer: TableLayer): void {
  for (const [key, value] of Object.entries(settings)) {
    if (value === "" || value === undefined || (typeof value === "number" && !Number.isFinite(value))) {
      delete settings[key];
    }
  }
  if (layer === "row") return;
  for (const [key, value] of Object.entries(COLUMN_SELECT_DEFAULTS)) {
    if (settings[key] === value) delete settings[key];
  }
  for (const key of OFF_BY_DEFAULT) {
    if (settings[key] === false) delete settings[key];
  }
}

/**
 * A table switched to another cell type: drop the column, row and cell
 * settings it doesn't have. A table that mixes types (a column, row or cell
 * with a type of its own, set in YAML) is left as it is: which settings are
 * meant for which type is then its author's business.
 */
function retypeTable(t: TableConfig, type: TableCellType): TableConfig {
  const ownType = (o: unknown) => !!o && typeof o === "object" && "type" in o;
  const mixed =
    (t.columns ?? []).some(ownType) ||
    (t.rows ?? []).some((r) => ownType(r) || (r?.cells ?? []).some(ownType));
  if (mixed) return t;
  const valid = VALID_KEYS_BY_TYPE[type];
  const keep = <T extends object>(obj: T, ...own: string[]): T =>
    Object.fromEntries(
      Object.entries(obj).filter(([k]) => own.includes(k) || (valid.has(k) && !["type", "entity", "label"].includes(k))),
    ) as T;
  const out: TableConfig = {
    ...t,
    rows: (t.rows ?? []).map((r) => ({
      ...keep(r, "label", "group"),
      cells: (r.cells ?? []).map((c) => (c && typeof c === "object" ? keep(c, "entity") : c)),
    })),
  };
  if (t.columns) out.columns = t.columns.map((c) => keep(c, "header", "group"));
  return out;
}

function tableRowFormData(row: TableRowConfig, count: number, type: TableCellType): Record<string, unknown> {
  const { cells, ...settings } = row;
  const data = tableSettingsFormData(settings, type, "row");
  data.label = row.label ?? "";
  for (let i = 0; i < count; i++) {
    const cell = cells?.[i];
    data[`cell_${i}`] = typeof cell === "string" ? cell : (cell?.entity ?? "");
  }
  return data;
}

function tableRowSchema(count: number, type: TableCellType): FormSchema {
  return [
    {
      type: "grid",
      name: "",
      schema: [
        { name: "label", selector: { text: {} } },
        { name: "group", selector: { text: {} } },
      ],
    },
    ...Array.from({ length: count }, (_, i) => ({ name: `cell_${i}`, selector: { entity: {} } })),
    TABLE_ROW_SETTINGS[type],
  ];
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
