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
    // An explicit label wins, but is trimmed so a single space (the editor's
    // way of saying "hide it" - clearing the field falls back to the default)
    // collapses to "" and hides the name. Same convention as the unit.
    if (this.config.label !== undefined) return this.config.label.trim();
    const s = this.stateObj;
    if (s?.attributes?.friendly_name) return String(s.attributes.friendly_name);
    if (this.config.entity) return this.config.entity;
    return "";
  }

  /**
   * Which attribute the numeric value is read from, or null when the value is
   * the entity state itself. Resolution order:
   *   1. an explicit `attribute` in the config
   *   2. null (use the state) when the state is already numeric
   *   3. a per-domain default for complex entities (weather, climate, …)
   */
  protected activeAttribute(): string | null {
    const explicit = (this.config as { attribute?: string }).attribute;
    if (explicit) return explicit;
    const s = this.stateObj;
    if (s && Number.isFinite(Number(s.state))) return null;
    const domain = (this.config.entity ?? "").split(".")[0];
    return DOMAIN_DEFAULT_ATTR[domain] ?? null;
  }

  /**
   * Numeric value to display: the chosen attribute if any, otherwise the
   * state. Returns null when not a finite number (unavailable, missing, etc.).
   */
  protected resolvedValue(): number | null {
    const s = this.stateObj;
    if (!s) return null;
    const attr = this.activeAttribute();
    const raw = attr ? s.attributes?.[attr] : s.state;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Unit shown beside a value. An explicit `unit` config always wins. A single
   * space (or any whitespace) trims to "" and hides the unit, while clearing
   * the field entirely falls back to the entity's unit. Otherwise: when reading
   * the state, use the entity's `unit_of_measurement`; when reading an
   * attribute, infer a unit for the well-known weather/climate/cover/… attrs.
   */
  protected resolvedUnit(): string {
    const cfg = this.config as { unit?: string };
    // Trim so a stray space doesn't render an empty unit chip; an explicit
    // empty/whitespace string therefore also means "no unit".
    if (cfg.unit !== undefined) return cfg.unit.trim();
    const s = this.stateObj;
    if (!s) return "";
    const attr = this.activeAttribute();
    if (!attr) {
      const u = s.attributes?.unit_of_measurement;
      return u != null ? String(u) : "";
    }
    return this.inferAttributeUnit(attr, s);
  }

  /** Best-effort unit for a known numeric attribute. */
  private inferAttributeUnit(attr: string, s: HassEntity): string {
    const a = s.attributes ?? {};
    const sysTemp = (this.hass?.config as { unit_system?: { temperature?: string } } | undefined)
      ?.unit_system?.temperature;
    const tempUnit = () => String(a.temperature_unit ?? sysTemp ?? "");
    switch (attr) {
      case "temperature":
      case "current_temperature":
      case "apparent_temperature":
      case "dew_point":
      case "target_temp_high":
      case "target_temp_low":
        return tempUnit();
      case "humidity":
      case "current_humidity":
      case "percentage":
      case "current_position":
      case "current_tilt_position":
      case "battery_level":
      case "cloud_coverage":
      case "uv_index":
        return attr === "uv_index" ? "" : "%";
      case "pressure":
        return String(a.pressure_unit ?? "");
      case "wind_speed":
      case "wind_gust_speed":
        return String(a.wind_speed_unit ?? "");
      case "visibility":
        return String(a.visibility_unit ?? "");
      default:
        return "";
    }
  }

  /**
   * Whether a status indicator LED should be lit. For climate this tracks
   * `hvac_action` (heating/cooling/… = active, idle/off = not); otherwise it's
   * the usual on-ish states.
   */
  protected isIndicatorActive(): boolean {
    const s = this.stateObj;
    if (!s) return false;
    if ((this.config.entity ?? "").startsWith("climate.")) {
      const action = s.attributes?.hvac_action;
      if (action != null) {
        return ["heating", "cooling", "drying", "fan"].includes(String(action));
      }
      return s.state !== "off" && s.state !== "unavailable" && s.state !== "unknown";
    }
    return ["on", "open", "playing", "home", "active", "heat", "cool", "auto"].includes(s.state);
  }

  /** Current entity value as a finite number (attribute-aware), or null. */
  protected numericState(): number | null {
    return this.resolvedValue();
  }

  /**
   * Digit count for a fixed-width value readout, derived from the configured
   * min/max range (+1 for a sign when min is negative). Clamped to 2..4.
   */
  protected valueDigits(): number {
    const cfg = this.config as { min?: number; max?: number };
    const min = cfg.min ?? 0;
    const max = cfg.max ?? 100;
    const span = Math.max(Math.abs(Math.round(min)), Math.abs(Math.round(max)), 1);
    const d = String(span).length + (min < 0 ? 1 : 0);
    return Math.min(4, Math.max(2, d));
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

/**
 * For complex entities whose state is categorical, the numeric value to show
 * by default comes from one of these attributes. Used when no explicit
 * `attribute` is configured and the state itself isn't numeric.
 */
const DOMAIN_DEFAULT_ATTR: Record<string, string> = {
  weather: "temperature",
  climate: "current_temperature",
  water_heater: "current_temperature",
  humidifier: "current_humidity",
  cover: "current_position",
  fan: "percentage",
  light: "brightness",
  media_player: "volume_level",
  vacuum: "battery_level",
  sun: "elevation",
};
