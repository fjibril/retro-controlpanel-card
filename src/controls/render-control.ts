import { html, type TemplateResult } from "lit";
import type { HomeAssistant } from "custom-card-helpers";
import type { EntityControlConfig, LabelStyle } from "../types.js";
import "./retro-seven-segment.js";
import "./retro-vu-meter.js";
import "./retro-gauge.js";
import "./retro-flip-switch.js";
import "./retro-button.js";

/**
 * The element for a single-entity control, used by panel rows, groups and
 * table cells alike. `compact` leaves out the label (see RetroControlBase).
 */
export function renderEntityControl(
  cfg: EntityControlConfig,
  hass: HomeAssistant | undefined,
  labelStyle: LabelStyle,
  compact = false,
): TemplateResult {
  switch (cfg.type) {
    case "seven_segment":
      return html`<retro-seven-segment
        ?compact=${compact}
        .hass=${hass}
        .config=${cfg}
        .labelStyle=${labelStyle}
      ></retro-seven-segment>`;
    case "vu_meter":
      return html`<retro-vu-meter
        ?compact=${compact}
        .hass=${hass}
        .config=${cfg}
        .labelStyle=${labelStyle}
      ></retro-vu-meter>`;
    case "gauge":
      return html`<retro-gauge
        ?compact=${compact}
        .hass=${hass}
        .config=${cfg}
        .labelStyle=${labelStyle}
      ></retro-gauge>`;
    case "flip_switch":
      return html`<retro-flip-switch
        ?compact=${compact}
        .hass=${hass}
        .config=${cfg}
        .labelStyle=${labelStyle}
      ></retro-flip-switch>`;
    case "button":
      return html`<retro-button
        ?compact=${compact}
        .hass=${hass}
        .config=${cfg}
        .labelStyle=${labelStyle}
      ></retro-button>`;
  }
}
