import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { GlowColor } from "../types.js";
import { GLOW_PALETTE } from "./glow-palette.js";

/**
 * Small status LED. Dim-but-visible "plastic" when off (you can still see the
 * colour), glowing with a halo when on. Used as a standalone indicator beside
 * numeric controls (e.g. lit while a climate entity is actively heating).
 */
@customElement("retro-indicator")
export class RetroIndicator extends LitElement {
  @property({ type: String }) color: GlowColor = "amber";
  /** Reflected so tests / styling can target `[on]`. */
  @property({ type: Boolean, reflect: true }) on = false;

  static styles = css`
    :host {
      display: inline-block;
      line-height: 0;
    }
    .led {
      display: block;
      width: 0.7em;
      height: 0.7em;
      border-radius: 50%;
      background:
        radial-gradient(
          circle at 32% 28%,
          color-mix(in srgb, var(--ind-color, var(--retro-primary)), white 25%) 0%,
          var(--ind-color, var(--retro-primary)) 55%,
          color-mix(in srgb, var(--ind-color, var(--retro-primary)), black 45%) 100%);
      filter: brightness(0.35) saturate(0.85);
      box-shadow:
        inset 0 0.05em 0.1em rgba(0, 0, 0, 0.4),
        inset 0 -0.04em 0.06em rgba(255, 255, 255, 0.2),
        0 0.05em 0.1em rgba(0, 0, 0, 0.5);
      transition: filter 120ms ease-out, box-shadow 120ms ease-out;
    }
    :host([on]) .led {
      filter: brightness(1.05) saturate(1);
      box-shadow:
        inset 0 0.05em 0.1em rgba(0, 0, 0, 0.25),
        inset 0 -0.04em 0.06em rgba(255, 255, 255, 0.35),
        0 0 0.4em var(--ind-color, var(--retro-primary)),
        0 0 1em var(--ind-soft, var(--retro-primary-dim));
    }
  `;

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has("color")) {
      const p = GLOW_PALETTE[this.color] ?? GLOW_PALETTE.amber;
      this.style.setProperty("--ind-color", p.on);
      this.style.setProperty("--ind-soft", p.soft);
    }
  }

  render() {
    return html`<span class="led" aria-hidden="true"></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "retro-indicator": RetroIndicator;
  }
}
