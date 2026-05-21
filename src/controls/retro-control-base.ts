import { LitElement } from "lit";
import { property } from "lit/decorators.js";
import type { HassEntity } from "home-assistant-js-websocket";
import type { HomeAssistant } from "custom-card-helpers";
import type {
  ActionConfig,
  ControlConfig,
  LabelStyle,
} from "../types.js";

export interface ActionHandlerEvent extends CustomEvent {
  detail: { action: "tap" | "hold" | "double_tap" };
}

/**
 * Shared base for every control element. Holds `hass` + `config` + the
 * resolved label style so the panel can hand them down uniformly, and exposes
 * helpers for state lookup and tap/hold/double-tap action dispatch.
 *
 * Default action policy mirrors HA's tile / entity card:
 *   - tap          : domain-aware (toggle for switchables, press for buttons,
 *                                  more-info otherwise)
 *   - hold         : more-info (this is what surfaces the history chart for
 *                                numeric sensors)
 *   - double_tap   : none
 *
 * Anything the user puts in `tap_action` / `hold_action` / `double_tap_action`
 * wins over these defaults.
 */
export abstract class RetroControlBase extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) config!: ControlConfig;
  @property({ attribute: false }) labelStyle: LabelStyle = "etched";

  protected get stateObj(): HassEntity | undefined {
    if (!this.hass || !this.config?.entity) return undefined;
    return this.hass.states[this.config.entity];
  }

  protected resolvedLabel(): string {
    if (this.config.label !== undefined) return this.config.label;
    const s = this.stateObj;
    if (s?.attributes?.friendly_name) return String(s.attributes.friendly_name);
    if (this.config.entity) return this.config.entity;
    return "";
  }

  /**
   * Unit shown beside a value. Pulled from the entity's
   * `unit_of_measurement` unless the config overrides it. An explicit empty
   * string (`unit: ""`) is honoured as "show no unit" - only an *absent*
   * `unit` key falls back to the entity's unit.
   */
  protected resolvedUnit(): string {
    const explicit = (this.config as { unit?: string }).unit;
    if (explicit !== undefined) return explicit;
    const u = this.stateObj?.attributes?.unit_of_measurement;
    return u != null ? String(u) : "";
  }

  /** Apply user width/height overrides to the host element on each config change. */
  protected applySizeOverrides(): void {
    if (this.config?.width) this.style.setProperty("--cell-w", this.config.width);
    else this.style.removeProperty("--cell-w");
    if (this.config?.height) this.style.setProperty("--cell-h", this.config.height);
    else this.style.removeProperty("--cell-h");
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has("config")) this.applySizeOverrides();
  }

  /** Route an action-handler event to the right configured action. */
  protected onAction = (ev: Event): void => {
    const action = (ev as ActionHandlerEvent).detail?.action ?? "tap";
    const cfg = this.actionConfigFor(action);
    if (cfg) void this.dispatchAction(cfg);
  };

  /**
   * Pick the action config to run for a given tap/hold/double_tap gesture,
   * falling back to per-domain sensible defaults when the user hasn't
   * configured anything explicit.
   */
  protected actionConfigFor(action: "tap" | "hold" | "double_tap"): ActionConfig | undefined {
    if (!this.config) return undefined;
    switch (action) {
      case "tap":        return this.config.tap_action ?? this.defaultTapAction();
      case "hold":       return this.config.hold_action ?? { action: "more-info" };
      case "double_tap": return this.config.double_tap_action;
    }
  }

  /** Per-domain default for the tap gesture. */
  protected defaultTapAction(): ActionConfig {
    const entity = this.config?.entity;
    if (!entity) return { action: "none" };
    const domain = entity.split(".")[0];
    switch (domain) {
      case "input_boolean":
      case "switch":
      case "light":
      case "fan":
      case "automation":
        return { action: "toggle" };
      case "script":
        return { action: "call-service", service: "script.turn_on", service_data: { entity_id: entity } };
      case "input_button":
        return { action: "call-service", service: "input_button.press", service_data: { entity_id: entity } };
      case "button":
        return { action: "call-service", service: "button.press", service_data: { entity_id: entity } };
      case "scene":
        return { action: "call-service", service: "scene.turn_on", service_data: { entity_id: entity } };
      default:
        return { action: "more-info" };
    }
  }

  /**
   * Execute an action config. Same surface area as HA's standard handleAction
   * (more-info / navigate / url / toggle / call-service / none), implemented
   * locally so we don't depend on quirks of `custom-card-helpers`'s toggle
   * path (which dispatches per-domain rather than via `homeassistant.toggle`).
   */
  protected async dispatchAction(cfg: ActionConfig): Promise<void> {
    if (!this.hass || cfg.action === "none") return;
    switch (cfg.action) {
      case "more-info":
        this.fireEvent("hass-more-info", { entityId: this.config?.entity });
        return;
      case "navigate":
        window.history.pushState(null, "", cfg.navigation_path);
        window.dispatchEvent(new Event("location-changed"));
        return;
      case "url":
        window.open(cfg.url_path, "_blank", "noopener");
        return;
      case "toggle":
        return this.toggleEntity();
      case "call-service": {
        const [domain, service] = cfg.service.split(".");
        if (!domain || !service) return;
        await this.hass.callService(domain, service, cfg.service_data ?? {});
        return;
      }
    }
  }

  /** Keyboard equivalent: Space or Enter fires the tap action. */
  protected onKey = (e: KeyboardEvent): void => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const cfg = this.actionConfigFor("tap");
      if (cfg) void this.dispatchAction(cfg);
    }
  };

  private async toggleEntity(): Promise<void> {
    const entity = this.config?.entity;
    if (!entity || !this.hass) return;
    // homeassistant.toggle figures out the right per-domain service.
    await this.hass.callService("homeassistant", "toggle", { entity_id: entity });
  }

  private fireEvent(type: string, detail?: unknown): void {
    this.dispatchEvent(
      new CustomEvent(type, { detail, bubbles: true, composed: true }),
    );
  }
}
