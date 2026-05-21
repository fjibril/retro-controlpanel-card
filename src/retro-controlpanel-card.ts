import { LitElement, html, nothing, type CSSResultGroup } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCardEditor } from "custom-card-helpers";
import {
  CARD_NAME,
  CARD_TAG,
  CARD_VERSION,
  CARD_DESCRIPTION,
} from "./const.js";
import type {
  ControlConfig,
  LabelStyle,
  RetroControlPanelCardConfig,
  RowConfig,
} from "./types.js";
import { panelStyles } from "./styles/panel-styles.js";
import { themeStyles, DEFAULT_THEME, ALL_THEMES } from "./styles/themes.js";

// Register every control as a side effect so they're available before the
// card tries to instantiate them.
import "./controls/retro-seven-segment.js";
import "./controls/retro-vu-meter.js";
import "./controls/retro-gauge.js";
import "./controls/retro-flip-switch.js";
import "./controls/retro-button.js";
import "./controls/retro-label.js";
// Editor element is bundled inline so HA can find it via getConfigElement().
import "./editor.js";

const KNOWN_TYPES = new Set([
  "seven_segment",
  "vu_meter",
  "gauge",
  "flip_switch",
  "button",
]);

@customElement(CARD_TAG)
export class RetroControlPanelCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: RetroControlPanelCardConfig;
  @state() private configError?: string;

  static styles: CSSResultGroup = [themeStyles, panelStyles];

  /**
   * Lovelace calls this with the YAML configuration. We validate it and throw
   * for fatal errors (so the card editor surfaces a red error), and store a
   * non-fatal error in state for partial issues.
   */
  setConfig(config: RetroControlPanelCardConfig): void {
    if (!config) throw new Error("Invalid configuration");
    if (!Array.isArray(config.rows)) {
      throw new Error("Configuration must include 'rows: [...]'");
    }
    for (const [ri, row] of config.rows.entries()) {
      if (!row || !Array.isArray(row.entities)) {
        throw new Error(`Row ${ri} must have an 'entities' array`);
      }
      for (const [ei, ent] of row.entities.entries()) {
        if (!ent || typeof ent !== "object") {
          throw new Error(`Row ${ri} entity ${ei} is not an object`);
        }
        if (!ent.type || !KNOWN_TYPES.has(ent.type)) {
          throw new Error(
            `Row ${ri} entity ${ei}: unknown type '${ent.type ?? "<missing>"}'. ` +
              `Expected one of: ${[...KNOWN_TYPES].join(", ")}`,
          );
        }
      }
    }
    this.config = config;
    this.configError = undefined;
  }

  /** Lovelace masonry view uses this to decide stacking weight. */
  getCardSize(): number {
    if (!this.config?.rows) return 1;
    return Math.max(1, this.config.rows.length);
  }

  /**
   * Sections (grid) view sizing. Declaring this is what tells HA the card is
   * grid-aware and removes the "does not fully support resizing" notice.
   *
   * The panel is content-sized (everything is in `em`, scaled by the `scale`
   * config), so we ask for auto height and default to full width, while
   * letting the user shrink it down to a sensible minimum in the layout editor.
   */
  public getGridOptions(): {
    columns?: number | "full";
    rows?: number | "auto";
    min_columns?: number;
    min_rows?: number;
  } {
    return {
      columns: "full",
      rows: "auto",
      min_columns: 3,
      min_rows: 1,
    };
  }

  /** Returns the visual-editor element for this card (used by the HA UI). */
  public static getConfigElement(): LovelaceCardEditor {
    return document.createElement("retro-controlpanel-card-editor") as LovelaceCardEditor;
  }

  /** Initial config used by the "Add card" picker. */
  static getStubConfig(): Partial<RetroControlPanelCardConfig> {
    return {
      title: "Retro Control Panel",
      theme: "amber",
      label_style: "etched",
      rows: [
        {
          entities: [
            { type: "flip_switch", entity: "input_boolean.example" },
            { type: "button", entity: "input_button.example" },
          ],
        },
      ],
    };
  }

  protected updated(): void {
    // Theme: swap the host class so the static stylesheet picks the right :host() rule.
    const theme = this.config?.theme ?? DEFAULT_THEME;
    for (const t of ALL_THEMES) this.classList.toggle(`theme-${t}`, t === theme);

    // Scale: drives the panel font-size, every dimension is in em.
    if (this.config?.scale !== undefined) {
      this.style.setProperty("--retro-scale", String(this.config.scale));
    } else {
      this.style.removeProperty("--retro-scale");
    }
  }

  render() {
    if (this.configError) {
      return html`<div class="error">${this.configError}</div>`;
    }
    if (!this.config) return html`<div></div>`;
    const labelStyle: LabelStyle = this.config.label_style ?? "etched";
    const titleStyle: LabelStyle = this.config.title_style ?? labelStyle;

    return html`
      <div class="panel" part="panel">
        ${this.renderScrew("tl", 24)}
        ${this.renderScrew("tr", -52)}
        ${this.renderScrew("bl", 68)}
        ${this.renderScrew("br", -14)}
        <div class="panel-inner">
          ${this.config.title
            ? html`<div class="title-row">
                <span class="title title-${titleStyle}">${this.config.title}</span>
              </div>`
            : nothing}
          <div class="rows">
            ${this.config.rows.map((row) => this.renderRow(row, labelStyle))}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * A corner screw, drawn as SVG for crisp edges at any size: a steel head
   * with a countersink bevel ring, a single slot rotated by `angle` (each
   * corner differs so they don't look stamped), plus a specular highlight.
   */
  private renderScrew(pos: "tl" | "tr" | "bl" | "br", angle: number) {
    const id = `screw-metal-${pos}`;
    return html`<span class="screw ${pos}">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <radialGradient id=${id} cx="34%" cy="28%" r="74%">
            <stop offset="0%" stop-color="#e8e8e8"></stop>
            <stop offset="40%" stop-color="#a6a6a6"></stop>
            <stop offset="78%" stop-color="#5a5a5a"></stop>
            <stop offset="100%" stop-color="#262626"></stop>
          </radialGradient>
        </defs>
        <!-- Countersink bevel: a darker ring the head sits inside. -->
        <circle cx="12" cy="12" r="11.5" fill="rgba(0,0,0,0.4)"></circle>
        <circle cx="12" cy="12" r="10.6" fill="rgba(255,255,255,0.08)"></circle>
        <!-- Screw head. -->
        <circle cx="12" cy="12" r="9.6" fill="url(#${id})"
                stroke="rgba(0,0,0,0.35)" stroke-width="0.5"></circle>
        <!-- Specular highlight, upper-left. -->
        <ellipse cx="8.6" cy="7.8" rx="3" ry="2" fill="rgba(255,255,255,0.4)"></ellipse>
        <!-- Slot groove + thin lit lip. -->
        <g transform="rotate(${angle} 12 12)">
          <rect x="2.6" y="10.6" width="18.8" height="2.8" rx="1.1" fill="rgba(0,0,0,0.62)"></rect>
          <rect x="2.6" y="10.4" width="18.8" height="0.7" rx="0.35" fill="rgba(255,255,255,0.22)"></rect>
        </g>
      </svg>
    </span>`;
  }

  private renderRow(row: RowConfig, defaultLabelStyle: LabelStyle) {
    const justify = row.justify ?? "center";
    return html`
      <div class="row" style="--row-justify: ${justify};">
        ${row.entities.map((ent) => this.renderControl(ent, defaultLabelStyle))}
      </div>
    `;
  }

  private renderControl(ent: ControlConfig, defaultLabelStyle: LabelStyle) {
    const labelStyle = ent.label_style ?? defaultLabelStyle;
    switch (ent.type) {
      case "seven_segment":
        return html`<div class="cell">
          <retro-seven-segment
            .hass=${this.hass}
            .config=${ent}
            .labelStyle=${labelStyle}
          ></retro-seven-segment>
        </div>`;
      case "vu_meter":
        return html`<div class="cell">
          <retro-vu-meter
            .hass=${this.hass}
            .config=${ent}
            .labelStyle=${labelStyle}
          ></retro-vu-meter>
        </div>`;
      case "gauge":
        return html`<div class="cell">
          <retro-gauge
            .hass=${this.hass}
            .config=${ent}
            .labelStyle=${labelStyle}
          ></retro-gauge>
        </div>`;
      case "flip_switch":
        return html`<div class="cell">
          <retro-flip-switch
            .hass=${this.hass}
            .config=${ent}
            .labelStyle=${labelStyle}
          ></retro-flip-switch>
        </div>`;
      case "button":
        return html`<div class="cell">
          <retro-button
            .hass=${this.hass}
            .config=${ent}
            .labelStyle=${labelStyle}
          ></retro-button>
        </div>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "retro-controlpanel-card": RetroControlPanelCard;
  }
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description?: string;
      preview?: boolean;
    }>;
  }
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: CARD_NAME,
    description: CARD_DESCRIPTION,
    preview: true,
  });
}

// Friendly banner in the browser console, matching HA-card convention.
// eslint-disable-next-line no-console
console.info(
  `%c ${CARD_NAME} %c v${CARD_VERSION} `,
  "color: #1a120a; background: #ffa033; font-weight: 700;",
  "color: #ffa033; background: #1a120a; font-weight: 700;",
);
