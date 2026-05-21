import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { LabelStyle } from "../types.js";

/**
 * Two-style label: "etched" (engraved into the metal panel) or "dymo"
 * (embossed black tape with white letters). Used by every control.
 */
@customElement("retro-label")
export class RetroLabel extends LitElement {
  @property({ type: String }) text = "";
  @property({ type: String }) styleName: LabelStyle = "etched";

  static styles = css`
    :host {
      display: inline-block;
      max-width: 100%;
    }
    .label {
      display: inline-block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
      font-size: 0.65em;
      line-height: 1.2;
    }
    .etched {
      color: var(--retro-label-etched-color);
      font-family: var(--retro-label-etched-font);
      letter-spacing: var(--retro-label-etched-tracking);
      text-transform: uppercase;
      text-shadow: var(--retro-label-etched-shadow);
      padding: 0 0.2em;
    }
    .dymo {
      color: var(--retro-label-dymo-color);
      background: var(--retro-label-dymo-bg);
      font-family: var(--retro-label-dymo-font);
      letter-spacing: var(--retro-label-dymo-tracking);
      text-transform: uppercase;
      box-shadow: var(--retro-label-dymo-shadow);
      padding: 0.15em 0.6em;
      border-radius: 0.15em;
    }
  `;

  render() {
    if (this.styleName === "none" || !this.text) return nothing;
    const cls = this.styleName === "dymo" ? "dymo" : "etched";
    return html`<span class="label ${cls}" part="label">${this.text}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "retro-label": RetroLabel;
  }
}
