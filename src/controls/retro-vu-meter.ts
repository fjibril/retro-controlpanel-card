import { html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { RetroControlBase } from "./retro-control-base.js";
import type { VuMeterConfig } from "./../types.js";
import { actionHandler, hasAction } from "./../action-handler-directive.js";
import "./retro-label.js";
import "./retro-mini-segments.js";

/**
 * Classic stacked-LED VU meter. Bottom segments are green, top segments are
 * red, with a yellow band in between. The boundaries are configured as two
 * percentages (`green_threshold`, `yellow_threshold`) which the user can think
 * of as the upper edge of each colour band.
 */
@customElement("retro-vu-meter")
export class RetroVuMeter extends RetroControlBase {
  declare config: VuMeterConfig;

  static styles = css`
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4em;
      width: var(--cell-w, auto);
      height: var(--cell-h, auto);
    }
    .meter {
      display: flex;
      padding: 0.35em;
      background: var(--retro-segment-bg);
      border-radius: 0.25em;
      box-shadow:
        inset 0 0.15em 0.3em rgba(0, 0, 0, 0.8),
        inset 0 -1px 0 rgba(255, 255, 255, 0.05);
      gap: 0.18em;
    }
    .meter.vertical {
      flex-direction: column-reverse;
      width: 1.4em;
      height: 5em;
    }
    .meter.horizontal {
      flex-direction: row;
      width: 5em;
      height: 1.4em;
    }
    .seg {
      flex: 1 1 0;
      border-radius: 0.08em;
      background: var(--retro-led-off);
      transition: background 80ms linear, box-shadow 80ms linear;
    }
    .seg.on.green {
      background: var(--retro-led-green);
      box-shadow: 0 0 0.25em var(--retro-led-green);
    }
    .seg.on.yellow {
      background: var(--retro-led-yellow);
      box-shadow: 0 0 0.25em var(--retro-led-yellow);
    }
    .seg.on.red {
      background: var(--retro-led-red);
      box-shadow: 0 0 0.25em var(--retro-led-red);
    }
    .meter.clickable {
      cursor: pointer;
      outline: none;
    }
    .meter.clickable:focus-visible {
      box-shadow:
        inset 0 0.15em 0.3em rgba(0, 0, 0, 0.8),
        inset 0 -1px 0 rgba(255, 255, 255, 0.05),
        0 0 0 0.15em var(--retro-primary);
    }

    /* Meter + scale layout. */
    .meter-wrap {
      display: inline-flex;
    }
    .meter-wrap.vertical { flex-direction: row; align-items: stretch; gap: 0.3em; }
    .meter-wrap.horizontal { flex-direction: column; align-items: stretch; gap: 0.2em; }

    /* Etched scale engraved into the panel beside the meter. */
    .scale {
      position: relative;
      font-size: 0.5em;
      font-family: var(--retro-label-etched-font);
      color: var(--retro-label-etched-color);
      text-shadow: var(--retro-label-etched-shadow);
      letter-spacing: 0.03em;
    }
    .scale.vertical { width: 2.2em; height: 10em; /* = 5em meter at 2x font */ }
    .scale.horizontal { width: 10em; height: 2em; }
    .scale-tick { position: absolute; display: flex; align-items: center; }
    .scale.vertical .scale-tick {
      right: 0;
      bottom: calc(var(--pos) * 100%);
      transform: translateY(50%);
      gap: 0.2em;
    }
    .scale.vertical .scale-num { text-align: right; min-width: 1.6em; }
    .scale.vertical .tickline { width: 0.35em; height: 1px; background: currentColor; opacity: 0.65; }
    .scale.horizontal .scale-tick {
      top: 0;
      left: calc(var(--pos) * 100%);
      transform: translateX(-50%);
      flex-direction: column-reverse;
      gap: 0.15em;
    }
    .scale.horizontal .tickline { width: 1px; height: 0.35em; background: currentColor; opacity: 0.65; }

    /* Tiny value readout sits just below the meter. */
    retro-mini-segments {
      font-size: 1.0em;
      margin-top: 0.1em;
    }
  `;

  render() {
    const cfg = this.config;
    const orientation = cfg.orientation ?? "vertical";
    const segments = Math.max(2, cfg.segments ?? 10);
    const lit = this.calcLitCount(segments);
    const items = Array.from({ length: segments }, (_, i) => {
      const colour = this.colourForSegment(i, segments);
      const on = i < lit;
      return html`<span class="seg ${on ? "on" : ""} ${colour}"></span>`;
    });

    const scale = cfg.show_scale ? this.renderScale(orientation) : nothing;

    return html`
      <div class="meter-wrap ${orientation}">
        ${orientation === "vertical" ? scale : nothing}
        <div
          class="meter clickable ${orientation}"
          part="meter"
          tabindex="0"
          role="button"
          aria-label=${this.resolvedLabel() || "vu meter"}
          @action=${this.onAction}
          @keydown=${this.onKey}
          .actionHandler=${actionHandler({
            hasHold: hasAction(cfg?.hold_action ?? { action: "more-info" }),
            hasDoubleClick: hasAction(cfg?.double_tap_action),
          })}
        >
          ${items}
        </div>
        ${orientation === "horizontal" ? scale : nothing}
      </div>
      ${cfg.show_value
        ? html`<retro-mini-segments
            style=${cfg.value_size ? `font-size:${cfg.value_size}em` : nothing}
            .value=${this.numericState()}
            .digits=${this.valueDigits()}
          ></retro-mini-segments>`
        : nothing}
      <retro-label .text=${this.resolvedLabel()} .styleName=${this.labelStyle}></retro-label>
    `;
  }

  /** Engraved numeric scale aligned to the meter (min at the low end). */
  private renderScale(orientation: "vertical" | "horizontal") {
    const cfg = this.config;
    const min = cfg.min ?? 0;
    const max = cfg.max ?? 100;
    const divisions = Math.max(1, cfg.scale_divisions ?? 4);
    const ticks = Array.from({ length: divisions + 1 }, (_, i) => {
      const frac = i / divisions;
      return { frac, value: min + frac * (max - min) };
    });
    return html`
      <div class="scale ${orientation}">
        ${ticks.map(
          (t) => html`<div class="scale-tick" style="--pos: ${t.frac}">
            <span class="scale-num">${formatScaleNum(t.value)}</span>
            <span class="tickline"></span>
          </div>`,
        )}
      </div>
    `;
  }

  /**
   * Number of segments that should be lit for the current entity value.
   * Returns 0 for unavailable / non-numeric states.
   */
  calcLitCount(segments: number): number {
    const cfg = this.config;
    const raw = this.stateObj?.state;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    const min = cfg.min ?? 0;
    const max = cfg.max ?? 100;
    if (max <= min) return 0;
    const pct = Math.max(0, Math.min(1, (n - min) / (max - min)));
    return Math.round(pct * segments);
  }

  /** Colour band for the segment at index `i` (0-based, 0 = first lit). */
  colourForSegment(i: number, segments: number): "green" | "yellow" | "red" {
    const cfg = this.config;
    // Both thresholds are the upper bound of their colour band as a percentage
    // of full scale. We trust the values as the user typed them - no sorting -
    // so that raising green_threshold actually adds more green segments
    // (and an inverted yellow < green simply means the yellow zone collapses).
    const greenTop = cfg.green_threshold ?? 60;
    const yellowTop = cfg.yellow_threshold ?? 85;

    const segPct = ((i + 1) / segments) * 100;
    if (segPct <= greenTop) return "green";
    if (segPct <= yellowTop) return "yellow";
    return "red";
  }
}

function formatScaleNum(v: number): string {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 100) / 10}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

declare global {
  interface HTMLElementTagNameMap {
    "retro-vu-meter": RetroVuMeter;
  }
}
