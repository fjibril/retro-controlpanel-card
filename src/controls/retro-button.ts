import { html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { RetroControlBase, type ActionHandlerEvent } from "./retro-control-base.js";
import type { ButtonConfig, GlowColor } from "./../types.js";
import { actionHandler, hasAction } from "./../action-handler-directive.js";
import { GLOW_PALETTE } from "./glow-palette.js";
import "./retro-label.js";

/**
 * Illuminated rectangular pushbutton. Glows when the bound entity is "on";
 * for stateless entities (input_button, script, button, scene) it pulses
 * briefly on press to signal the action fired.
 */
@customElement("retro-button")
export class RetroButton extends RetroControlBase {
  declare config: ButtonConfig;

  /** Briefly true after a stateless button press, for the press-flash effect. */
  @state() private flashing = false;
  private flashTimer?: ReturnType<typeof setTimeout>;

  static styles = css`
    :host {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4em;
      width: var(--cell-w, auto);
      height: var(--cell-h, auto);
    }
    button.btn {
      position: relative;
      min-width: 3.6em;
      height: 2em;
      padding: 0 0.55em;
      border: 0;
      border-radius: 0.25em;
      background: var(--retro-button-bezel);
      box-shadow:
        0 0.15em 0.25em rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      cursor: pointer;
      outline: none;
      font: inherit;
      transition: transform 60ms ease-out;
    }
    button.btn:active {
      transform: translateY(0.05em);
    }
    button.btn:focus-visible {
      box-shadow:
        0 0.15em 0.25em rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.1),
        0 0 0 0.15em var(--retro-primary);
    }
    .face {
      position: absolute;
      inset: 0.25em;
      border-radius: 0.18em;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 0.25em;
      font-family: var(--retro-label-etched-font);
      font-size: 0.7em;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      /* Off state: the actual on-colour plastic, dimmed by a dark overlay -
         so you can still SEE the colour (amber/red/green) even when it's
         not lit, just like a real bulb behind tinted plastic. */
      color: rgba(255, 255, 255, 0.32);
      background:
        linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.72)),
        var(--btn-face-on, var(--retro-button-face-on));
      box-shadow:
        inset 0 0.1em 0.2em rgba(0, 0, 0, 0.55),
        inset 0 -1px 0 rgba(255, 255, 255, 0.05);
      transition:
        background 120ms ease-out,
        color 120ms ease-out,
        box-shadow 120ms ease-out;
    }
    .face.on,
    .face.flash {
      color: var(--btn-text-on, var(--retro-button-text-on));
      background: var(--btn-face-on, var(--retro-button-face-on));
      box-shadow:
        inset 0 0.1em 0.2em rgba(0, 0, 0, 0.4),
        0 0 0.4em var(--btn-glow, var(--retro-primary)),
        0 0 1.2em var(--btn-glow-soft, var(--retro-primary-dim));
    }
    .face.flash {
      animation: flash 280ms ease-out;
    }
    @keyframes flash {
      0%   { filter: brightness(1.4); }
      100% { filter: brightness(1); }
    }
  `;

  private get isOn(): boolean {
    if (!this.stateObj) return false;
    const s = this.stateObj.state;
    return s === "on" || s === "open" || s === "playing" || s === "home";
  }

  private get isStateless(): boolean {
    const entity = this.config?.entity;
    if (!entity) return true;
    const domain = entity.split(".")[0];
    return ["script", "input_button", "button", "scene"].includes(domain);
  }

  protected updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (changed.has("config")) this.applyColorOverride(this.config?.color);
  }

  render() {
    const cfg = this.config;
    const showOn = this.isOn || this.flashing;

    return html`
      <button
        class="btn"
        type="button"
        role="button"
        aria-pressed=${this.isOn ? "true" : "false"}
        aria-label=${this.resolvedLabel() || "button"}
        @action=${this.handleButtonAction}
        .actionHandler=${actionHandler({
          hasHold: hasAction(cfg?.hold_action ?? { action: "more-info" }),
          hasDoubleClick: hasAction(cfg?.double_tap_action),
        })}
      >
        <span class=${classMap({ face: true, on: showOn && !this.flashing, flash: this.flashing })}>
          ${cfg.text ?? ""}
        </span>
      </button>
      <retro-label .text=${this.resolvedLabel()} .styleName=${this.labelStyle}></retro-label>
    `;
  }

  private applyColorOverride(color: GlowColor | undefined): void {
    if (!color) {
      this.style.removeProperty("--btn-glow");
      this.style.removeProperty("--btn-glow-soft");
      this.style.removeProperty("--btn-face-on");
      this.style.removeProperty("--btn-text-on");
      return;
    }
    const p = GLOW_PALETTE[color];
    this.style.setProperty("--btn-glow", p.on);
    this.style.setProperty("--btn-glow-soft", p.soft);
    this.style.setProperty("--btn-face-on", p.on);
    this.style.setProperty("--btn-text-on", p.text);
  }

  private handleButtonAction = (ev: Event) => {
    const action = (ev as ActionHandlerEvent).detail?.action ?? "tap";
    if (action === "tap" && this.isStateless) {
      this.flashing = true;
      if (this.flashTimer) clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => { this.flashing = false; }, 280);
    }
    this.onAction(ev);
  };

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.flashTimer) clearTimeout(this.flashTimer);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "retro-button": RetroButton;
  }
}
