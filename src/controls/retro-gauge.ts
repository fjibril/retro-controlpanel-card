import { html, css, svg, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { RetroControlBase } from "./retro-control-base.js";
import type { GaugeConfig } from "./../types.js";
import { actionHandler, hasAction } from "./../action-handler-directive.js";
import "./retro-label.js";
import "./retro-mini-segments.js";

/**
 * Semicircular analog gauge with sweeping needle, painted scale and tick
 * marks. The dial face is ivory ("painted aluminium"), the needle is the
 * theme's danger colour, tick labels are theme ink.
 */
@customElement("retro-gauge")
export class RetroGauge extends RetroControlBase {
  declare config: GaugeConfig;

  static styles = css`
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4em;
      width: var(--cell-w, auto);
      height: var(--cell-h, auto);
    }
    /* Outer wrapper takes the unit text + the cutout. */
    .gauge {
      width: 8em;
      height: 4.4em;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }
    /* The dial cutout itself: a half-circle aperture milled into the panel.
       The cutout's background IS the dial face colour, so the SVG only has to
       draw marks (arc, ticks, labels, needle) on top. The combined inset and
       drop shadows sell the "set into the panel" look - a dark crescent at
       the top edge of the cutout (recessed) and a thin bright lower lip
       (machined chamfer catching light). */
    .cutout {
      flex: 1 1 auto;
      position: relative;
      border-radius: 50% 50% 0.18em 0.18em / 100% 100% 0.18em 0.18em;
      background: var(--retro-gauge-bg);
      box-shadow:
        inset 0 0.32em 0.5em rgba(0, 0, 0, 0.55),
        inset 0 0.08em 0 rgba(0, 0, 0, 0.55),
        inset 0 -0.04em 0 rgba(255, 255, 255, 0.18),
        0 0.05em 0 rgba(255, 255, 255, 0.08);
      overflow: hidden;
      cursor: pointer;
      outline: none;
    }
    .cutout:focus-visible {
      box-shadow:
        inset 0 0.32em 0.5em rgba(0, 0, 0, 0.55),
        inset 0 0.08em 0 rgba(0, 0, 0, 0.55),
        inset 0 -0.04em 0 rgba(255, 255, 255, 0.18),
        0 0 0 0.15em var(--retro-primary);
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .arc { stroke: var(--retro-gauge-ink); stroke-width: 1; fill: none; }
    .tick { stroke: var(--retro-gauge-ink); stroke-width: 1.1; }
    .tick.major { stroke-width: 1.8; }
    .tick-label {
      font-family: var(--retro-label-etched-font);
      font-size: 8px;
      font-weight: 600;
      fill: var(--retro-gauge-ink);
      text-anchor: middle;
    }
    .danger-arc {
      stroke: var(--retro-led-red);
      stroke-width: 3;
      fill: none;
      opacity: 0.9;
    }
    .needle {
      stroke: var(--retro-gauge-needle);
      stroke-width: 1.8;
      stroke-linecap: round;
      transform-origin: 50px 50px;
      transition: transform 250ms ease-out;
    }
    .needle-cap {
      fill: var(--retro-gauge-ink);
    }
    .unit-text {
      font-family: var(--retro-label-etched-font);
      font-size: 7px;
      font-weight: 600;
      fill: var(--retro-gauge-ink);
      text-anchor: middle;
      text-transform: uppercase;
    }
    /* Tiny value readout, sunk into the bottom-centre of the dial. */
    .value-readout {
      bottom: 0.18em;
      left: 50%;
      font-size: 1.0em;
      z-index: 3;
    }
  `;

  render() {
    const cfg = this.config;
    const min = cfg.min ?? 0;
    const max = cfg.max ?? 100;
    const majorTicks = Math.max(2, cfg.major_ticks ?? 5);
    const minorTicks = Math.max(0, cfg.minor_ticks ?? 4);

    const angle = this.needleAngle(); // -90..+90, undefined if unavailable
    const ticks = this.buildTicks(majorTicks, minorTicks, min, max);
    const unit = this.resolvedUnit();

    return html`
      <div class="gauge" part="gauge">
        <div
          class="cutout"
          tabindex="0"
          role="button"
          aria-label=${this.resolvedLabel() || "gauge"}
          @action=${this.onAction}
          @keydown=${this.onKey}
          .actionHandler=${actionHandler({
            hasHold: hasAction(cfg?.hold_action ?? { action: "more-info" }),
            hasDoubleClick: hasAction(cfg?.double_tap_action),
          })}
        >
          <svg viewBox="0 0 100 55" preserveAspectRatio="xMidYMid meet"
               xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <!-- No dial-bg path - the .cutout wrapper provides the dial colour. -->
            <path class="arc"
                  d="M 8,50 A 42,42 0 0,1 92,50" />
            <!-- Red danger arc on the top 15% of the scale -->
            <path class="danger-arc"
                  d=${this.dangerArcPath()} />

            <!-- Tick marks (lines) and major-tick labels (texts) rendered as
                 two separate map passes: nesting a conditional svg template
                 inside another svg-template interpolation drops the inner
                 template in happy-dom (and is brittle in real browsers too). -->
            ${ticks.map((t) => svg`
              <line class="tick ${t.major ? "major" : ""}"
                    x1=${t.x1} y1=${t.y1} x2=${t.x2} y2=${t.y2} />
            `)}
            ${ticks.map((t) =>
              t.major && t.label !== undefined
                ? svg`<text class="tick-label" x=${t.lx} y=${t.ly}>${t.label}</text>`
                : nothing,
            )}

            <!-- Unit, printed on the dial face above the pivot pin. Drawn
                 before the needle so the needle passes over it. -->
            ${unit
              ? svg`<text class="unit-text" x="50" y="41">${unit}</text>`
              : nothing}

            <!-- Needle -->
            ${angle !== undefined ? svg`
              <line class="needle"
                    x1="50" y1="50" x2="50" y2="10"
                    style="transform: rotate(${angle}deg);" />
            ` : nothing}
            <circle class="needle-cap" cx="50" cy="50" r="3" />
          </svg>
        </div>        
      </div>
      ${cfg.show_value
          ? html`<retro-mini-segments
              class="value-readout"
              style=${cfg.value_size ? `font-size:${cfg.value_size}em` : nothing}
              .value=${this.numericState()}
              .digits=${this.valueDigits()}
            ></retro-mini-segments>`
          : nothing}
      <retro-label .text=${this.resolvedLabel()} .styleName=${this.labelStyle}></retro-label>
    `;
  }

  /** Map the entity value to a needle rotation in degrees (-90 = min, +90 = max). */
  needleAngle(): number | undefined {
    const cfg = this.config;
    const raw = this.stateObj?.state;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    const min = cfg.min ?? 0;
    const max = cfg.max ?? 100;
    if (max <= min) return 0;
    const clamped = Math.max(min, Math.min(max, n));
    const frac = (clamped - min) / (max - min);
    return -90 + frac * 180;
  }

  /** Path for the red "danger zone" on the top of the scale (last 15%). */
  private dangerArcPath(): string {
    // Convert 85% and 100% positions to arc endpoint coordinates on radius 42.
    const p1 = polarToCartesian(50, 50, 42, this.fracToTickAngle(0.85));
    const p2 = polarToCartesian(50, 50, 42, this.fracToTickAngle(1));
    return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A 42 42 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  /** Build evenly-spaced tick marks for the dial. */
  private buildTicks(majorCount: number, minorPerMajor: number, min: number, max: number) {
    const ticks: Array<{
      major: boolean;
      x1: number; y1: number; x2: number; y2: number;
      lx?: number; ly?: number; label?: string;
    }> = [];
    const segments = majorCount - 1;
    const subdivisions = segments * (minorPerMajor + 1);
    for (let i = 0; i <= subdivisions; i++) {
      const frac = i / subdivisions;
      const isMajor = i % (minorPerMajor + 1) === 0;
      const angle = this.fracToTickAngle(frac);
      const outer = polarToCartesian(50, 50, 42, angle);
      const inner = polarToCartesian(50, 50, isMajor ? 35 : 38, angle);
      const tick: (typeof ticks)[number] = {
        major: isMajor,
        x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y,
      };
      if (isMajor) {
        const value = min + frac * (max - min);
        const labelPos = polarToCartesian(50, 50, 26, angle);
        tick.lx = labelPos.x;
        tick.ly = labelPos.y + 3;
        tick.label = formatTickLabel(value);
      }
      ticks.push(tick);
    }
    return ticks;
  }

  /**
   * Convert a fractional position on the scale (0 = min/left, 1 = max/right)
   * to an angle in degrees on the standard math circle (0 = right, 90 = up).
   */
  private fracToTickAngle(frac: number): number {
    return 180 - frac * 180;
  }
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function formatTickLabel(v: number): string {
  // Keep tick labels short so they fit on the dial.
  if (Math.abs(v) >= 1000) return `${Math.round(v / 100) / 10}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

declare global {
  interface HTMLElementTagNameMap {
    "retro-gauge": RetroGauge;
  }
}
