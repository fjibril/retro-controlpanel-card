/**
 * Vitest setup: tiny helpers shared across unit specs.
 *
 * Each spec attaches the component under test to `document.body` so Lit can
 * actually mount it and we can read the shadow DOM after `updateComplete`.
 */
import type { HomeAssistant } from "custom-card-helpers";
import type { HassEntity } from "home-assistant-js-websocket";
import { vi } from "vitest";

export type MockHomeAssistant = HomeAssistant & {
  callService: ReturnType<typeof vi.fn>;
};

export function makeHass(
  states: Record<string, Partial<HassEntity> & { state: string }> = {},
): MockHomeAssistant {
  const full: HomeAssistant["states"] = {};
  for (const [id, s] of Object.entries(states)) {
    full[id] = {
      entity_id: id,
      state: s.state,
      attributes: s.attributes ?? {},
      last_changed: "",
      last_updated: "",
      context: { id: "x", parent_id: null, user_id: null },
    } as HassEntity;
  }
  return {
    states: full,
    callService: vi.fn().mockResolvedValue(undefined),
    // The rest of HomeAssistant is unused by our controls; cast through unknown.
  } as unknown as MockHomeAssistant;
}

export async function mount<T extends HTMLElement>(tag: string, setup: (el: T) => void): Promise<T> {
  const el = document.createElement(tag) as T;
  setup(el);
  document.body.appendChild(el);
  // Lit's updateComplete is on every LitElement; if the element doesn't have
  // it, the next microtask is fine.
  // @ts-expect-error - duck-type to avoid pulling Lit types into the helper
  if (typeof el.updateComplete?.then === "function") {
    // @ts-expect-error - same as above
    await el.updateComplete;
  } else {
    await Promise.resolve();
  }
  return el;
}

export function cleanup(el: HTMLElement): void {
  el.remove();
}
