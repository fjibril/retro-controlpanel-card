import { html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { RetroControlBase } from "./retro-control-base.js";
import type { GlowColor, SevenSegmentConfig } from "./../types.js";
import { actionHandler, hasAction } from "./../action-handler-directive.js";
import { GLOW_PALETTE } from "./glow-palette.js";
import { digitSvg } from "./segment-shapes.js";
import "./retro-label.js";
import "./retro-indicator.js";

/**
 * Classic 7-segment LED display. Renders one SVG per digit, plus optional
 * decimal points and a minus sign. All segments are present in the DOM at low
 * opacity to give the authentic "ghost segment" look.
 */
@customElement("retro-seven-segment")
export class RetroSevenSegment extends RetroControlBase {
  declare config: SevenSegmentConfig;

  static styles = css`
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4em;
      width: var(--cell-w, auto);
      height: var(--cell-h, auto);
    }
    /* Display window + the unit label sitting beside it on the panel surface. */
    .display-row {
      display: inline-flex;
      align-items: center;
      gap: 0.45em;
    }
    .display {
      display: inline-flex;
      align-items: center;
      padding: 0.4em 0.6em;
      background: var(--retro-segment-bg);
      border-radius: 0.25em;
      box-shadow:
        inset 0 0.15em 0.3em rgba(0, 0, 0, 0.8),
        inset 0 -1px 0 rgba(255, 255, 255, 0.05);
      min-height: 2.2em;
    }
    .digit {
      width: 1.4em;
      height: 2em;
      display: inline-block;
    }
    .dp {
      width: 0.35em;
      height: 2em;
      display: inline-flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 0.15em;
    }
    .dp-dot {
      width: 0.25em;
      height: 0.25em;
      border-radius: 50%;
      background: var(--retro-segment-on);
      box-shadow: var(--retro-segment-glow);
    }
    .dp-dot.off {
      background: var(--retro-segment-off);
      box-shadow: none;
    }
    /* Unit sits on the panel beside the window, so it's an etched/dymo label
       (not a glowing LCD element). Note: no uppercase - units keep their
       case (kWh, °C, ...). */
    .unit {
      font-size: 0.85em;
      white-space: nowrap;
    }
    .unit.etched {
      font-family: var(--retro-label-etched-font);
      color: var(--retro-label-etched-color);
      text-shadow: var(--retro-label-etched-shadow);
      letter-spacing: var(--retro-label-etched-tracking);
    }
    .unit.dymo {
      font-family: var(--retro-label-dymo-font);
      color: var(--retro-label-dymo-color);
      background: var(--retro-label-dymo-bg);
      box-shadow: var(--retro-label-dymo-shadow);
      padding: 0.1em 0.4em;
      border-radius: 0.12em;
    }
    .unit.none {
      font-family: var(--retro-label-etched-font);
      color: var(--retro-label-etched-color);
    }
    .display.clickable {
      cursor: pointer;
      outline: none;
    }
    .display.clickable:focus-visible {
      box-shadow:
        inset 0 0.15em 0.3em rgba(0, 0, 0, 0.8),
        inset 0 -1px 0 rgba(255, 255, 255, 0.05),
        0 0 0 0.15em var(--retro-primary);
    }
    svg .seg-on {
      fill: var(--retro-segment-on);
      filter: drop-shadow(var(--retro-segment-glow));
    }
    svg .seg-off {
      fill: var(--retro-segment-off);
    }
    .label-row {
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
    }
    .label-row retro-indicator {
      font-size: 0.7em;
    }
  `;

  protected updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (changed.has("config")) this.applyColorOverride(this.config?.color);
  }

  render() {
    const cfg = this.config;
    const numDigits = Math.max(1, cfg.num_digits ?? 4);
    const tokens = this.formatTokens(numDigits);
    const unit = this.resolvedUnit();

    return html`
      <div class="display-row">
        <div
          class="display clickable"
          part="display"
          tabindex="0"
          role="button"
          aria-label=${this.resolvedLabel() || "display"}
          @action=${this.onAction}
          @keydown=${this.onKey}
          .actionHandler=${actionHandler({
            hasHold: hasAction(cfg?.hold_action ?? { action: "more-info" }),
            hasDoubleClick: hasAction(cfg?.double_tap_action),
          })}
        >
          ${tokens.map((t) => this.renderToken(t))}
        </div>
        ${unit ? html`<span class="unit ${this.labelStyle}">${unit}</span>` : nothing}
      </div>
      <div class="label-row">
        ${cfg.indicator
          ? html`<retro-indicator .color=${cfg.indicator} .on=${this.isIndicatorActive()}></retro-indicator>`
          : nothing}
        <retro-label .text=${this.resolvedLabel()} .styleName=${this.labelStyle}></retro-label>
      </div>
    `;
  }

  private applyColorOverride(color: GlowColor | undefined): void {
    if (!color) {
      this.style.removeProperty("--retro-segment-on");
      this.style.removeProperty("--retro-segment-off");
      this.style.removeProperty("--retro-segment-glow");
      return;
    }
    const p = GLOW_PALETTE[color];
    this.style.setProperty("--retro-segment-on", p.on);
    this.style.setProperty("--retro-segment-off", p.off);
    this.style.setProperty("--retro-segment-glow", `0 0 0.18em ${p.on}`);
  }

  /** A token is either a digit/letter ("0"-"9", "-", " ") or "." for a DP. */
  private renderToken(token: string) {
    if (token === ".") {
      return html`<span class="dp"><span class="dp-dot"></span></span>`;
    }
    return html`<span class="digit">${this.renderDigit(token)}</span>`;
  }

  private renderDigit(ch: string) {
    return digitSvg(ch);
  }

  /**
   * Compute the digit/dot tokens shown on the display from the current entity
   * state. Returns an array like ["1","2",".","3","4"] for "12.34". Pads with
   * zeros or spaces depending on `leading_zeros`, replaces overflow with "-"
   * characters, shows "----" on unavailable state.
   */
  formatTokens(numDigits: number): string[] {
    const cfg = this.config;
    const blank = (): string[] => Array.from({ length: numDigits }, () => "-");

    // Attribute-aware: state for plain numerics, the chosen/default attribute
    // for complex entities (weather, climate, …).
    const num = this.resolvedValue();
    if (num === null) return blank();

    const minFrac = cfg.minimum_fraction_digits ?? 0;
    const maxFrac = cfg.maximum_fraction_digits ?? 0;
    const negative = num < 0;
    const abs = Math.abs(num);

    const absStr = abs.toLocaleString("en-US", {
      useGrouping: false,
      minimumFractionDigits: Math.min(minFrac, maxFrac),
      maximumFractionDigits: maxFrac,
    });

    // Split into integer & fractional parts for padding logic.
    const [intPart, fracPart = ""] = absStr.split(".");
    const signedInt = (negative ? "-" : "") + intPart;
    const availableForInt = numDigits - fracPart.length;

    if (signedInt.length > availableForInt) {
      // Overflow: render as all-dashes.
      return blank();
    }

    let paddedInt: string;
    if (cfg.leading_zeros) {
      // Sign on the far left, zero-padding between sign and digit: -007.
      const zeroPadWidth = availableForInt - (negative ? 1 : 0);
      paddedInt = (negative ? "-" : "") + intPart.padStart(zeroPadWidth, "0");
    } else {
      // Space-pad the whole signed integer; the sign stays glued to the digit
      // ("   -7") which is how a calculator renders right-aligned negatives.
      paddedInt = signedInt.padStart(availableForInt, " ");
    }

    const str = paddedInt + (fracPart ? "." + fracPart : "");

    // Convert to tokens: a "." attaches to the previous digit slot rather than
    // taking up its own slot, matching real seven-seg behaviour.
    const tokens: string[] = [];
    for (const c of str) {
      if (c === ".") tokens.push(".");
      else tokens.push(c);
    }
    return tokens;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "retro-seven-segment": RetroSevenSegment;
  }
}
