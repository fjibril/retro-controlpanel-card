/**
 * Action handler directive.
 *
 * Mirrors the action-handler used across the HA frontend / custom-card-helpers
 * ecosystem: binds an element so that short tap, long press and double tap
 * dispatch a single `action` CustomEvent with `detail.action` set to
 * `"tap" | "hold" | "double_tap"`.
 *
 * Usage in a Lit template:
 *
 *   <button
 *     @action=${this.onAction}
 *     .actionHandler=${actionHandler({
 *       hasHold: true,
 *       hasDoubleClick: hasAction(this.config.double_tap_action),
 *     })}
 *   ></button>
 *
 * Implementation notes:
 *   - A single hidden <action-handler> element lives at the bottom of <body>
 *     and stores the press timer / held flag; binding adds the needed pointer
 *     listeners to the target element and dispatches the synthesised events
 *     when the gesture finishes.
 *   - The element is registered idempotently so multiple cards on the page
 *     don't fight over the tag name.
 */
import { noChange } from "lit";
import {
  AttributePart,
  directive,
  Directive,
  DirectiveParameters,
  PartInfo,
  PartType,
} from "lit/directive.js";

export interface ActionHandlerOptions {
  hasHold?: boolean;
  hasDoubleClick?: boolean;
  disabled?: boolean;
}

interface BoundState {
  options: ActionHandlerOptions;
  start: (ev: Event) => void;
  end: (ev: Event) => void;
}

interface ElementWithBinding extends Element {
  actionHandler?: BoundState;
}

class RetroActionHandler extends HTMLElement {
  /** Press threshold (ms) above which a tap becomes a hold. */
  public holdTime = 500;
  /** Window in which a second click counts as a double-tap. */
  public doubleClickTime = 250;

  private timer: number | undefined;
  private held = false;
  private dblClickTimer: number | undefined;
  /** Timestamp of the last touchend, to drop the synthetic click that follows. */
  private lastTouchEnd = 0;

  public bind(element: Element, options: ActionHandlerOptions): void {
    const el = element as ElementWithBinding;
    if (el.actionHandler) {
      const prev = el.actionHandler.options;
      if (
        prev.hasHold === options.hasHold &&
        prev.hasDoubleClick === options.hasDoubleClick &&
        prev.disabled === options.disabled
      ) {
        return;
      }
      // Options changed - unbind old listeners and re-bind.
      element.removeEventListener("touchstart", el.actionHandler.start);
      element.removeEventListener("touchend", el.actionHandler.end);
      element.removeEventListener("touchcancel", el.actionHandler.end);
      element.removeEventListener("mousedown", el.actionHandler.start);
      element.removeEventListener("click", el.actionHandler.end);
    }

    const start = (_ev: Event) => {
      this.held = false;
      if (options.hasHold) {
        clearTimeout(this.timer);
        this.timer = window.setTimeout(() => {
          this.held = true;
        }, this.holdTime);
      }
    };

    const end = (ev: Event) => {
      if (options.disabled) return;

      const isTouch = ev.type === "touchend" || ev.type === "touchcancel";
      // A tap on a touch screen fires touchend AND a synthesized click ~300ms
      // later. Without this guard both run, firing the action twice (a toggle
      // ends up back where it started - the "flicker"). Always clear the timer,
      // but drop the ghost click.
      const isGhostClick = ev.type === "click" && Date.now() - this.lastTouchEnd < 700;

      clearTimeout(this.timer);
      this.timer = undefined;

      if (isGhostClick) return;
      if (isTouch) {
        this.lastTouchEnd = Date.now();
        // Belt-and-suspenders: also ask the browser not to emit the ghost click.
        if (ev.cancelable) ev.preventDefault();
      }

      if (this.held) {
        this.fire(element, "hold");
        return;
      }

      if (options.hasDoubleClick) {
        if (this.dblClickTimer === undefined) {
          this.dblClickTimer = window.setTimeout(() => {
            this.dblClickTimer = undefined;
            this.fire(element, "tap");
          }, this.doubleClickTime);
        } else {
          clearTimeout(this.dblClickTimer);
          this.dblClickTimer = undefined;
          this.fire(element, "double_tap");
        }
      } else {
        this.fire(element, "tap");
      }
    };

    el.actionHandler = { options, start, end };

    if ("ontouchstart" in window) {
      element.addEventListener("touchstart", start, { passive: true });
      element.addEventListener("touchend", end);
      element.addEventListener("touchcancel", end);
    }
    element.addEventListener("mousedown", start, { passive: true });
    element.addEventListener("click", end);
  }

  private fire(target: Element, action: "tap" | "hold" | "double_tap"): void {
    target.dispatchEvent(
      new CustomEvent("action", {
        detail: { action },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

if (!customElements.get("retro-action-handler")) {
  customElements.define("retro-action-handler", RetroActionHandler);
}

let cached: RetroActionHandler | undefined;
function getActionHandler(): RetroActionHandler {
  if (cached && cached.isConnected) return cached;
  const existing = document.body.querySelector("retro-action-handler");
  if (existing) {
    cached = existing as RetroActionHandler;
    return cached;
  }
  cached = document.createElement("retro-action-handler") as RetroActionHandler;
  document.body.appendChild(cached);
  return cached;
}

export const actionHandler = directive(
  class extends Directive {
    constructor(partInfo: PartInfo) {
      super(partInfo);
      if (partInfo.type !== PartType.PROPERTY || partInfo.name !== "actionHandler") {
        throw new Error("actionHandler can only be used as a .actionHandler property binding");
      }
    }
    update(part: AttributePart, [options]: DirectiveParameters<this>) {
      getActionHandler().bind(part.element, options ?? {});
      return noChange;
    }
    render(_options?: ActionHandlerOptions) {
      return noChange;
    }
  },
);

/** Mirrors the helper from custom-card-helpers - true if an action config is set and not "none". */
export function hasAction(config?: { action?: string }): boolean {
  return config !== undefined && config.action !== "none";
}
