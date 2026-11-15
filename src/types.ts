import type { HomeAssistant, LovelaceCardConfig } from "custom-card-helpers";

export type ThemeName = "amber" | "green" | "red" | "aluminium";
export type LabelStyle = "etched" | "dymo" | "none";
export type GlowColor = "amber" | "green" | "red" | "white" | "blue";
/**
 * Decorative frame drawn around a row's controls, grouping them visually.
 *  - `none`     : no frame (default)
 *  - `embossed` : raised metal bezel around the group (continuous border)
 *  - `screwed`  : sub-panel pressed into the row with four corner screws
 *  - `stencil`  : painted L-shaped brackets at the four corners only
 */
export type RowGroupStyle = "none" | "embossed" | "screwed" | "stencil";

export interface BaseControlConfig {
  /** HA entity id; optional only for visual spacers/labels-only controls. */
  entity?: string;
  type: ControlType;
  /** Override the friendly_name with a custom label. Leave unset to inherit the
   *  friendly_name; set to a single space to hide the label entirely. */
  label?: string;
  /** CSS width override (e.g. "8em", "120px"). */
  width?: string;
  /** CSS height override. */
  height?: string;
  /** Action on short tap. Default: per-domain (toggle for switch-like, press for buttons, more-info otherwise). */
  tap_action?: ActionConfig;
  /** Action on long press. Default: more-info (shows entity details / history). */
  hold_action?: ActionConfig;
  /** Action on double tap. Default: none. */
  double_tap_action?: ActionConfig;
}

/** Tap / hold / double-tap actions, in the format Home Assistant's action editor writes. */
export type ActionConfig =
  | { action: "toggle" }
  | { action: "more-info"; entity?: string }
  | { action: "none" }
  | { action: "navigate"; navigation_path: string; navigation_replace?: boolean }
  | { action: "url"; url_path: string }
  | {
      action: "perform-action";
      perform_action: string;
      data?: Record<string, unknown>;
      target?: Record<string, unknown>;
    }
  /** The older name of perform-action, still found in existing configs. */
  | {
      action: "call-service";
      service: string;
      service_data?: Record<string, unknown>;
      data?: Record<string, unknown>;
      target?: Record<string, unknown>;
    };

/**
 * What a seven-segment display shows:
 *  - `number`    : the numeric value (default)
 *  - `time`      : a timestamp as HH:MM; with no entity, the current time (clock)
 *  - `countdown` : time until a timestamp; "-" prefix once it has passed
 */
export type SevenSegmentMode = "number" | "time" | "countdown";

/**
 * One conditional colour. A rule matches when its value lies strictly inside
 * `above` / `below` (either or both; with neither it matches any value).
 * The value is the display's own, or that of `entity` when given: a plain
 * number, or for a timestamp the minutes until it (negative once passed).
 */
export interface ColorRule {
  color: GlowColor;
  /** Test this entity instead of the display's own value. */
  entity?: string;
  above?: number;
  below?: number;
}

export interface SevenSegmentConfig extends BaseControlConfig {
  type: "seven_segment";
  /** Defaults to "number". The digit / fraction / leading-zero keys only apply to "number". */
  display_mode?: SevenSegmentMode;
  /** Time and countdown modes: add a seconds slot (HH:MM:SS). */
  show_seconds?: boolean;
  num_digits?: number;
  leading_zeros?: boolean;
  maximum_fraction_digits?: number;
  minimum_fraction_digits?: number;
  /** Unit suffix shown beside the digits (etched onto the bezel). Leave unset
   *  to inherit the entity's unit; set to a single space to hide it entirely. */
  unit?: string;
  /** Glow colour of the segments. Defaults to theme primary. */
  color?: GlowColor;
  /** Conditional colours; the first matching rule wins, otherwise `color` applies. */
  color_rules?: ColorRule[];
  /** Numeric attribute to display instead of the state (e.g. for weather/climate). */
  attribute?: string;
  /** Status LED beside the label in this colour (lit when the entity is active / heating). */
  indicator?: GlowColor;
}

export interface VuMeterConfig extends BaseControlConfig {
  type: "vu_meter";
  min?: number;
  max?: number;
  /** Percentage (0-100) at which segments become green vs yellow. */
  green_threshold?: number;
  /** Percentage (0-100) at which segments become yellow vs red. */
  yellow_threshold?: number;
  segments?: number;
  orientation?: "vertical" | "horizontal";
  /** Show an etched/embossed numeric scale beside the meter. */
  show_scale?: boolean;
  /** Number of labelled divisions on the scale (default 4 → 5 labels). */
  scale_divisions?: number;
  /** Show a tiny seven-segment readout of the current value. */
  show_value?: boolean;
  /** Font-size (in em) of the value readout. Overrides the default size. */
  value_size?: number;
  /** Glow colour of the value readout. Defaults to theme primary. */
  value_color?: GlowColor;
  /** Numeric attribute to display instead of the state (e.g. for weather/climate). */
  attribute?: string;
  /** Status LED beside the label in this colour (lit when the entity is active / heating). */
  indicator?: GlowColor;
}

export interface GaugeConfig extends BaseControlConfig {
  type: "gauge";
  min?: number;
  max?: number;
  /** Unit suffix shown beside the readout. Leave unset to inherit the entity's
   *  unit; set to a single space to hide it entirely. */
  unit?: string;
  /** Number of major (numbered) tick marks across the arc. */
  major_ticks?: number;
  /** Number of minor (unnumbered) tick marks between each pair of majors. */
  minor_ticks?: number;
  /** Show a tiny seven-segment readout of the current value. */
  show_value?: boolean;
  /** Font-size (in em) of the value readout. Overrides the default size. */
  value_size?: number;
  /** Glow colour of the value readout. Defaults to theme primary. */
  value_color?: GlowColor;
  /** Numeric attribute to display instead of the state (e.g. for weather/climate). */
  attribute?: string;
  /** Status LED beside the label in this colour (lit when the entity is active / heating). */
  indicator?: GlowColor;
}

export interface FlipSwitchConfig extends BaseControlConfig {
  type: "flip_switch";
  /** Show a small status LED next to the switch in this colour. Omit for none. */
  indicator?: GlowColor;
  /** Which side the indicator LED sits on. Defaults to "right". */
  indicator_position?: "left" | "right";
}

export interface ButtonConfig extends BaseControlConfig {
  type: "button";
  /** Glow colour of the illuminated rectangle. Defaults to theme primary. */
  color?: GlowColor;
  /** Override the text shown on the button face. */
  text?: string;
}

/**
 * A nested cluster of controls inside a row. Sits in the parent's flex layout
 * as one inline-flex unit, but holds its own `entities[]` (which may include
 * further groups). The optional frame + label work just like a row's.
 */
export interface GroupConfig {
  type: "group";
  /** Optional cluster label. Same single-space-hides convention as control labels. */
  label?: string;
  /** Label style for this group (and the cluster's frame label). Falls back to the panel default. */
  label_style?: LabelStyle;
  /** Decorative frame around the cluster. Defaults to "none". */
  group_style?: RowGroupStyle;
  /** Size multiplier for this cluster, on top of the panel's (and row's) scale. */
  scale?: number;
  /**
   * Grow to fill the rest of its line (sharing it with other groups that
   * fill), rather than hugging its controls.
   */
  fill_width?: boolean;
  entities: ControlConfig[];
  /** CSS width override. */
  width?: string;
  /** CSS height override. */
  height?: string;
}

/** The control types a table's cells can be (one type per table). */
export type TableCellType = EntityControlConfig["type"];

/** A control's settings, without what a table decides for its cells. */
type CellSettings<T> = Omit<T, "type" | "entity" | "label">;

/**
 * Settings a table column, row or cell gives its cells: those of the cells'
 * type. Settings of other types are ignored.
 */
export type TableCellOptions = Partial<
  CellSettings<SevenSegmentConfig> &
    CellSettings<VuMeterConfig> &
    CellSettings<GaugeConfig> &
    CellSettings<FlipSwitchConfig> &
    CellSettings<ButtonConfig>
> & {
  /**
   * A different control type for the cells of this column or row, or for
   * this cell (YAML only; the editor sets the type per table). The cell's
   * own wins, then its row's, then its column's, then the table's cell_type.
   */
  type?: TableCellType;
};

export interface TableColumnConfig extends TableCellOptions {
  /** Column heading, e.g. a unit such as "°C". Keeps its case. */
  header?: string;
  /**
   * Heading over a set of columns, e.g. a room. Neighbouring columns with the
   * same group share one heading, drawn as a bracket across them.
   */
  group?: string;
}

export interface TableCellConfig extends TableCellOptions {
  entity?: string;
}

export interface TableRowConfig extends TableCellOptions {
  /** Row label, shown left of the cells. */
  label?: string;
  /**
   * Name for a set of rows, e.g. a room. Neighbouring rows with the same group
   * share one name, left of a bracket that spans them.
   */
  group?: string;
  /** One per column: an entity id, a cell config, or null / "" for an empty cell. */
  cells: Array<string | TableCellConfig | null>;
}

/**
 * A dense matrix of controls: row labels on the left, column headers on top,
 * a compact control in every cell. A cell takes its column's settings, then
 * its row's, then its own; the whole table scales with `scale`.
 */
export interface TableConfig {
  type: "table";
  /** What the cells are, unless a column, row or cell says otherwise. Defaults to "seven_segment". */
  cell_type?: TableCellType;
  /** Size of the whole table relative to its row. */
  scale?: number;
  /** Make every column as wide as the widest one. */
  equal_columns?: boolean;
  columns?: TableColumnConfig[];
  rows: TableRowConfig[];
}

export type ControlConfig =
  | SevenSegmentConfig
  | VuMeterConfig
  | GaugeConfig
  | FlipSwitchConfig
  | ButtonConfig
  | GroupConfig
  | TableConfig;

export type ControlType = ControlConfig["type"];

/** The controls that render a single entity (everything except groups and tables). */
export type EntityControlConfig = Exclude<ControlConfig, GroupConfig | TableConfig>;

export interface RowConfig {
  entities: ControlConfig[];
  /** Optional CSS justify-content override for this row. */
  justify?: "start" | "center" | "end" | "space-between" | "space-around";
  /** Decorative frame around this row's controls. Defaults to "none". */
  group_style?: RowGroupStyle;
  /** Optional row title. Same single-space-hides convention as control labels. */
  label?: string;
  /** Label style for this row's title. Falls back to the panel default. */
  label_style?: LabelStyle;
  /** Size multiplier for this row, on top of the panel's scale. */
  scale?: number;
  /** Stretch the row's frame across the whole panel, rather than hugging its controls. */
  fill_width?: boolean;
}

export interface RetroControlPanelCardConfig extends LovelaceCardConfig {
  type: string;
  title?: string;
  /** Default theme for the whole panel. */
  theme?: ThemeName;
  /** Default label style for every control. */
  label_style?: LabelStyle;
  /** Style of the panel title specifically. Falls back to `label_style`. */
  title_style?: LabelStyle;
  /** Multiplier applied to the panel font-size, scales every control. */
  scale?: number;
  rows: RowConfig[];
}

export interface ControlElementProps {
  hass?: HomeAssistant;
  config: ControlConfig;
  labelStyle: LabelStyle;
}
