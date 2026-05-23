import { html, css, svg, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { RetroControlBase } from "./retro-control-base.js";
import type { FlipSwitchConfig } from "./../types.js";
import { actionHandler, hasAction } from "./../action-handler-directive.js";
import "./retro-label.js";
import "./retro-indicator.js";

/**
 * Top-down view of an industrial bat-handle toggle switch.
 *
 * What you see, from below up:
 *   - the hex chrome nut that fixes the switch to the panel
 *   - the round threaded bushing in its centre
 *   - the lever cap (the rounded chrome bullet on top of the shaft) - this is
 *     the part that moves: ON shifts it up, OFF shifts it down, mirroring the
 *     real-world lever leaning toward one side
 *
 * Optional status LED beside the switch (configurable colour + side); the
 * dim "plastic" tint stays visible when off so it always reads as a coloured
 * indicator rather than disappearing into the panel.
 */
@customElement("retro-flip-switch")
export class RetroFlipSwitch extends RetroControlBase {
  declare config: FlipSwitchConfig;

  static styles = css`
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5em;
      width: var(--cell-w, auto);
      height: var(--cell-h, auto);
    }
    .row {
      display: inline-flex;
      align-items: center;
      gap: 0.55em;
      cursor: pointer;
      outline: none;
    }
    .row:focus-visible {
      outline: 2px solid var(--retro-primary);
      outline-offset: 0.2em;
      border-radius: 0.3em;
    }
    .switch {
      width: 2.4em;
      height: 2.4em;
      display: block;
    }
    .switch svg {
      width: 100%;
      height: 100%;
      display: block;
      filter: drop-shadow(0 0.06em 0.1em rgba(0, 0, 0, 0.5));
    }
    /* The lever group is what visibly moves. */
    .lever {
      transition: transform 220ms cubic-bezier(0.42, 1.7, 0.5, 1);
    }
    .lever.up   { transform: translateY(-13px); }
    .lever.down { transform: translateY(13px); }
  `;

  private get isOn(): boolean {
    const state = this.stateObj?.state;
    return state === "on" || state === "open" || state === "playing" || state === "home";
  }

  render() {
    const on = this.isOn;
    const cfg = this.config;
    const indicatorOnLeft = cfg?.indicator && cfg.indicator_position === "left";
    const indicatorOnRight = cfg?.indicator && cfg.indicator_position !== "left";
    const indicator = cfg?.indicator
      ? html`<retro-indicator .color=${cfg.indicator} .on=${on}></retro-indicator>`
      : nothing;

    return html`
      <div
        class="row"
        tabindex="0"
        role="switch"
        aria-checked=${on ? "true" : "false"}
        aria-label=${this.resolvedLabel() || "switch"}
        @action=${this.onAction}
        @keydown=${this.onKey}
        .actionHandler=${actionHandler({
          hasHold: hasAction(cfg?.hold_action ?? { action: "more-info" }),
          hasDoubleClick: hasAction(cfg?.double_tap_action),
        })}
      >
        ${indicatorOnLeft ? indicator : nothing}
        <div class="switch">${this.renderSwitch(on)}</div>
        ${indicatorOnRight ? indicator : nothing}
      </div>
      <retro-label .text=${this.resolvedLabel()} .styleName=${this.labelStyle}></retro-label>
    `;
  }

  private renderSwitch(on: boolean) {
    return svg`
      <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <radialGradient id="rfs-hex" cx="50%" cy="32%" r="68%">
            <stop offset="0%"  stop-color="#f4f4f4"/>
            <stop offset="45%" stop-color="#c8c8c8"/>
            <stop offset="85%" stop-color="#6a6a6a"/>
            <stop offset="100%" stop-color="#2e2e2e"/>
          </radialGradient>
          <radialGradient id="rfs-bushing" cx="50%" cy="42%" r="58%">
            <stop offset="0%"  stop-color="#9c9c9c"/>
            <stop offset="55%" stop-color="#5a5a5a"/>
            <stop offset="100%" stop-color="#1a1a1a"/>
          </radialGradient>
          <radialGradient id="rfs-bushing-rim" cx="50%" cy="35%" r="60%">
            <stop offset="0%"  stop-color="#e8e8e8"/>
            <stop offset="100%" stop-color="#4c4c4c"/>
          </radialGradient>
          <radialGradient id="rfs-cap" cx="35%" cy="30%" r="80%">
            <stop offset="0%"  stop-color="#ffffff"/>
            <stop offset="40%" stop-color="#dddddd"/>
            <stop offset="80%" stop-color="#7a7a7a"/>
            <stop offset="100%" stop-color="#222222"/>
          </radialGradient>
        </defs>

        <polygon
          points="8,18 8,42 30,55 52,42 52,18 30,5"
          fill="url(#rfs-hex)"
          stroke="rgba(0,0,0,0.4)"
          stroke-width="0.6" />

        <circle cx="30" cy="30" r="14" fill="url(#rfs-bushing-rim)" />
        <circle cx="30" cy="30" r="11" fill="url(#rfs-bushing)" />
        <circle cx="30" cy="30" r="11" fill="none"
                stroke="rgba(0,0,0,0.55)" stroke-width="1" />

        <g class=${classMap({ lever: true, up: on, down: !on })}>
          <ellipse cx="30" cy="32" rx="7" ry="3.5"
                   fill="rgba(0,0,0,0.45)" />
          <ellipse cx="30" cy="30" rx="6.5" ry="8"
                   fill="url(#rfs-cap)"
                   stroke="rgba(0,0,0,0.35)" stroke-width="0.4" />
          <ellipse cx="27.5" cy="27" rx="2.2" ry="3"
                   fill="rgba(255,255,255,0.55)" />
        </g>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "retro-flip-switch": RetroFlipSwitch;
  }
}
