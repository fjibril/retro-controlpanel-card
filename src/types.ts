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

export type ActionConfig =
  | { action: "toggle" }
  | { action: "more-info" }
  | { action: "none" }
  | { action: "navigate"; navigation_path: string }
  | { action: "url"; url_path: string }
  | { action: "call-service"; service: string; service_data?: Record<string, unknown> };

export interface SevenSegmentConfig extends BaseControlConfig {
  type: "seven_segment";
  num_digits?: number;
  leading_zeros?: boolean;
  maximum_fraction_digits?: number;
  minimum_fraction_digits?: number;
  /** Unit suffix shown beside the digits (etched onto the bezel). Leave unset
   *  to inherit the entity's unit; set to a single space to hide it entirely. */
  unit?: string;
  /** Glow colour of the segments. Defaults to theme primary. */
  color?: GlowColor;
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

export type ControlConfig =
  | SevenSegmentConfig
  | VuMeterConfig
  | GaugeConfig
  | FlipSwitchConfig
  | ButtonConfig;

export type ControlType = ControlConfig["type"];

export interface RowConfig {
  entities: ControlConfig[];
  /** Optional CSS justify-content override for this row. */
  justify?: "start" | "center" | "end" | "space-between" | "space-around";
  /** Decorative frame around this row's controls. Defaults to "none". */
  group_style?: RowGroupStyle;
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
