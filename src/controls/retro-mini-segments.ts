import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { digitSvg, integerTokens } from "./segment-shapes.js";

/**
 * Tiny inline seven-segment readout: a small dark LCD window showing an
 * integer value, used by the gauge and VU meter to surface the current value.
 * Glows in the theme's segment colour like a real little display. Sizes off
 * the host font-size, so callers control how small it is.
 */
@customElement("retro-mini-segments")
export class RetroMiniSegments extends LitElement {
  /** Value to show; null/undefined or non-finite renders as dashes. */
  @property({ attribute: false }) value: number | null = null;
  /** Number of digit slots. */
  @property({ type: Number }) digits = 3;

  static styles = css`
    :host {
      display: inline-block;
      line-height: 0;
    }
    .win {
      display: inline-flex;
      align-items: center;
      gap: 0.04em;
      padding: 0.12em 0.22em;
      background: var(--retro-segment-bg);
      border-radius: 0.18em;
      box-shadow:
        inset 0 0.08em 0.18em rgba(0, 0, 0, 0.85),
        inset 0 -1px 0 rgba(255, 255, 255, 0.05);
    }
    .d {
      width: 0.46em;
      height: 0.7em;
      display: inline-block;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    svg .seg-on {
      fill: var(--retro-segment-on);
      filter: drop-shadow(var(--retro-segment-glow));
    }
    svg .seg-off {
      fill: var(--retro-segment-off);
    }
  `;

  render() {
    const tokens = integerTokens(this.value, Math.max(1, this.digits));
    return html`
      <div class="win" part="window">
        ${tokens.map((t) => html`<span class="d">${digitSvg(t)}</span>`)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "retro-mini-segments": RetroMiniSegments;
  }
}
