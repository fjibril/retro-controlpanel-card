import { afterEach, describe, expect, it } from "vitest";
import { integerTokens } from "../../src/controls/segment-shapes.js";
import "../../src/controls/retro-mini-segments.js";
import type { RetroMiniSegments } from "../../src/controls/retro-mini-segments.js";
import { cleanup, mount } from "./setup.js";

describe("integerTokens", () => {
  it("right-aligns and space-pads", () => {
    expect(integerTokens(55, 3)).toEqual([" ", "5", "5"]);
    expect(integerTokens(5, 3)).toEqual([" ", " ", "5"]);
  });

  it("rounds to the nearest integer", () => {
    expect(integerTokens(55.7, 3)).toEqual([" ", "5", "6"]);
    expect(integerTokens(55.2, 3)).toEqual([" ", "5", "5"]);
  });

  it("keeps the minus glued to the digits", () => {
    expect(integerTokens(-5, 3)).toEqual([" ", "-", "5"]);
  });

  it("shows dashes for null / non-finite", () => {
    expect(integerTokens(null, 3)).toEqual(["-", "-", "-"]);
    expect(integerTokens(undefined, 3)).toEqual(["-", "-", "-"]);
    expect(integerTokens(Number.NaN, 3)).toEqual(["-", "-", "-"]);
  });

  it("shows dashes on overflow", () => {
    expect(integerTokens(1234, 3)).toEqual(["-", "-", "-"]);
  });
});

describe("retro-mini-segments", () => {
  let toDispose: HTMLElement[] = [];
  afterEach(() => { toDispose.forEach(cleanup); toDispose = []; });

  it("renders one digit slot per configured digit", async () => {
    const el = await mount<RetroMiniSegments>("retro-mini-segments", (n) => {
      n.value = 42;
      n.digits = 3;
    });
    toDispose.push(el);
    expect(el.shadowRoot?.querySelectorAll(".win .d").length).toBe(3);
  });

  it("does not set a colour override when color is unset", async () => {
    const el = await mount<RetroMiniSegments>("retro-mini-segments", (n) => {
      n.value = 42;
      n.digits = 3;
    });
    toDispose.push(el);
    expect(el.style.getPropertyValue("--retro-segment-on")).toBe("");
  });

  it("applies a glow colour override when color is set", async () => {
    const el = await mount<RetroMiniSegments>("retro-mini-segments", (n) => {
      n.value = 42;
      n.digits = 3;
      n.color = "red";
    });
    toDispose.push(el);
    expect(el.style.getPropertyValue("--retro-segment-on")).not.toBe("");
    expect(el.style.getPropertyValue("--retro-segment-glow")).not.toBe("");
  });

  it("removes the colour override when color is cleared", async () => {
    const el = await mount<RetroMiniSegments>("retro-mini-segments", (n) => {
      n.value = 42;
      n.digits = 3;
      n.color = "green";
    });
    toDispose.push(el);
    expect(el.style.getPropertyValue("--retro-segment-on")).not.toBe("");
    el.color = undefined;
    await el.updateComplete;
    expect(el.style.getPropertyValue("--retro-segment-on")).toBe("");
  });
});
