import { css, unsafeCSS } from "lit";
import type { ThemeName } from "../types.js";

/**
 * Themes are bundles of CSS custom properties applied to the host element
 * via a `.theme-<name>` class. Components read the variables; no component
 * ever hard-codes colours.
 *
 * Implementation note: we encode each theme as a `:host(.theme-...)` rule
 * inside a single static stylesheet that the card always loads. Switching
 * themes then becomes a one-class swap on the host element — no dynamic
 * stylesheet injection, no Lit `<style>` interpolation gotchas.
 */

const baseVars = `
  --retro-panel-radius: 0.5em;
  /* Frame wide enough to actually mount the corner screws in. */
  --retro-panel-bezel-width: 1.15em;
  --retro-panel-inner-padding: 0.8em;

  --retro-label-etched-color: rgba(235, 230, 220, 0.92);
  --retro-label-etched-shadow:
    0 1px 0 rgba(0, 0, 0, 0.7),
    0 -1px 0 rgba(255, 255, 255, 0.15);
  --retro-label-etched-font: "Futura", "Helvetica Neue", "Arial Narrow", sans-serif;
  --retro-label-etched-tracking: 0.18em;

  --retro-label-dymo-bg: #1a1a1a;
  --retro-label-dymo-color: #f4f0e8;
  --retro-label-dymo-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -1px 0 rgba(0, 0, 0, 0.5),
    0 1px 2px rgba(0, 0, 0, 0.5);
  --retro-label-dymo-font: "Courier New", "Lucida Console", monospace;
  --retro-label-dymo-tracking: 0.15em;
`;

const amberVars = `
  ${baseVars}
  --retro-panel-bg: linear-gradient(180deg, #2a2825 0%, #1a1816 100%);
  --retro-panel-bezel: linear-gradient(180deg, #444140 0%, #2a2725 50%, #1a1816 100%);
  --retro-panel-screw: #1c1a17;

  --retro-primary: #ffa033;
  --retro-primary-dim: rgba(255, 160, 51, 0.18);
  --retro-primary-glow: 0 0 0.35em rgba(255, 160, 51, 0.55), 0 0 1.2em rgba(255, 160, 51, 0.25);

  --retro-led-green: #6dff5b;
  --retro-led-yellow: #ffe24a;
  --retro-led-red: #ff3a2c;
  --retro-led-off: #2a1f10;

  --retro-segment-bg: #1a120a;
  --retro-segment-on: #ffa033;
  --retro-segment-off: rgba(255, 160, 51, 0.06);
  --retro-segment-glow: 0 0 0.18em rgba(255, 160, 51, 0.85);

  --retro-gauge-bg: #f1ead9;
  --retro-gauge-ink: #1c1a17;
  --retro-gauge-needle: #b51e1a;

  --retro-button-bezel: linear-gradient(180deg, #555049 0%, #2a2725 100%);
  --retro-button-face-off: #2a201a;
  --retro-button-face-on: #ffa033;
  --retro-button-text-off: rgba(255, 160, 51, 0.55);
  --retro-button-text-on: #1a120a;

  --retro-switch-base: linear-gradient(180deg, #3a3633 0%, #1a1816 100%);
  --retro-switch-lever: linear-gradient(180deg, #f4f0e8 0%, #c9c3b6 100%);
  --retro-switch-lever-shadow: 0 0.15em 0.25em rgba(0, 0, 0, 0.6);
`;

const greenVars = `
  ${baseVars}
  --retro-panel-bg: linear-gradient(180deg, #3b4326 0%, #232812 100%);
  --retro-panel-bezel: linear-gradient(180deg, #565f3a 0%, #3b4326 50%, #232812 100%);
  --retro-panel-screw: #1a1f0e;

  --retro-primary: #6dff7a;
  --retro-primary-dim: rgba(109, 255, 122, 0.18);
  --retro-primary-glow: 0 0 0.35em rgba(109, 255, 122, 0.55), 0 0 1.2em rgba(109, 255, 122, 0.25);

  --retro-led-green: #6dff7a;
  --retro-led-yellow: #ffe24a;
  --retro-led-red: #ff3a2c;
  --retro-led-off: #0e1a10;

  --retro-segment-bg: #0e1a10;
  --retro-segment-on: #6dff7a;
  --retro-segment-off: rgba(109, 255, 122, 0.06);
  --retro-segment-glow: 0 0 0.18em rgba(109, 255, 122, 0.85);

  --retro-gauge-bg: #e8e5d2;
  --retro-gauge-ink: #1a1f0e;
  --retro-gauge-needle: #b51e1a;

  --retro-button-bezel: linear-gradient(180deg, #565f3a 0%, #232812 100%);
  --retro-button-face-off: #1a2418;
  --retro-button-face-on: #6dff7a;
  --retro-button-text-off: rgba(109, 255, 122, 0.55);
  --retro-button-text-on: #0e1a10;

  --retro-switch-base: linear-gradient(180deg, #4a533a 0%, #232812 100%);
  --retro-switch-lever: linear-gradient(180deg, #f4f0e8 0%, #c9c3b6 100%);
  --retro-switch-lever-shadow: 0 0.15em 0.25em rgba(0, 0, 0, 0.6);
`;

/**
 * Brushed aluminium - light metallic panel with horizontal brush lines. Etched
 * labels go dark-on-light. Display windows stay dark cutouts with amber glow,
 * the way real-world instruments look set into an aluminium console.
 */
const aluminiumVars = `
  ${baseVars}
  --retro-panel-bg:
    repeating-linear-gradient(
      0deg,
      rgba(255, 255, 255, 0.05) 0px,
      rgba(255, 255, 255, 0.05) 1px,
      transparent 1px,
      transparent 3px),
    linear-gradient(180deg, #c8c8c8 0%, #9c9c9c 100%);
  --retro-panel-bezel:
    linear-gradient(180deg, #e6e6e6 0%, #b8b8b8 50%, #888 100%);
  --retro-panel-screw: #3a3a3a;

  --retro-primary: #ffa033;
  --retro-primary-dim: rgba(255, 160, 51, 0.18);
  --retro-primary-glow: 0 0 0.35em rgba(255, 160, 51, 0.55), 0 0 1.2em rgba(255, 160, 51, 0.25);

  --retro-led-green: #5cd14a;
  --retro-led-yellow: #f0c92a;
  --retro-led-red: #e02e1f;
  --retro-led-off: #4a4a4a;

  --retro-segment-bg: #1c1c1c;
  --retro-segment-on: #ffa033;
  --retro-segment-off: rgba(255, 160, 51, 0.05);
  --retro-segment-glow: 0 0 0.18em rgba(255, 160, 51, 0.85);

  --retro-gauge-bg: #f4ede0;
  --retro-gauge-ink: #1a1a1a;
  --retro-gauge-needle: #b51e1a;

  --retro-button-bezel: linear-gradient(180deg, #d6d6d6 0%, #8a8a8a 100%);
  --retro-button-face-off: #2a2a2a;
  --retro-button-face-on: #ffa033;
  --retro-button-text-off: rgba(255, 160, 51, 0.55);
  --retro-button-text-on: #1a120a;

  --retro-switch-base: linear-gradient(180deg, #c8c8c8 0%, #888 100%);
  --retro-switch-lever: linear-gradient(180deg, #f4f0e8 0%, #c9c3b6 100%);
  --retro-switch-lever-shadow: 0 0.15em 0.25em rgba(0, 0, 0, 0.4);

  /* Etched labels: engraved into LIGHT metal, so we flip the contrast - dark
     ink with a top highlight (suggesting depth via reflected light). */
  --retro-label-etched-color: rgba(28, 28, 28, 0.88);
  --retro-label-etched-shadow:
    0 1px 0 rgba(255, 255, 255, 0.75),
    0 -1px 0 rgba(0, 0, 0, 0.25);
`;

const redVars = `
  ${baseVars}
  --retro-panel-bg: linear-gradient(180deg, #2a1f1c 0%, #1a1311 100%);
  --retro-panel-bezel: linear-gradient(180deg, #4a3a36 0%, #2a1f1c 50%, #1a1311 100%);
  --retro-panel-screw: #150e0c;

  --retro-primary: #ff4a3a;
  --retro-primary-dim: rgba(255, 74, 58, 0.18);
  --retro-primary-glow: 0 0 0.35em rgba(255, 74, 58, 0.55), 0 0 1.2em rgba(255, 74, 58, 0.25);

  --retro-led-green: #6dff5b;
  --retro-led-yellow: #ffe24a;
  --retro-led-red: #ff3a2c;
  --retro-led-off: #2a1110;

  --retro-segment-bg: #1a0a09;
  --retro-segment-on: #ff4a3a;
  --retro-segment-off: rgba(255, 74, 58, 0.06);
  --retro-segment-glow: 0 0 0.18em rgba(255, 74, 58, 0.85);

  --retro-gauge-bg: #f1ead9;
  --retro-gauge-ink: #1a0a09;
  --retro-gauge-needle: #ff4a3a;

  --retro-button-bezel: linear-gradient(180deg, #4a3a36 0%, #1a1311 100%);
  --retro-button-face-off: #2a1110;
  --retro-button-face-on: #ff4a3a;
  --retro-button-text-off: rgba(255, 74, 58, 0.55);
  --retro-button-text-on: #1a0a09;

  --retro-switch-base: linear-gradient(180deg, #3a2a27 0%, #1a1311 100%);
  --retro-switch-lever: linear-gradient(180deg, #f4f0e8 0%, #c9c3b6 100%);
  --retro-switch-lever-shadow: 0 0.15em 0.25em rgba(0, 0, 0, 0.6);
`;

/**
 * All theme rules in a single stylesheet — the card always loads this and
 * picks a theme by toggling the `.theme-<name>` class on its host.
 *
 * The first `:host` rule provides defaults so things still look right if no
 * theme class is applied (e.g. when the card is mounted before setConfig
 * has run).
 */
export const themeStyles = css`
  :host { ${unsafeCSS(amberVars)} }
  :host(.theme-amber)     { ${unsafeCSS(amberVars)} }
  :host(.theme-green)     { ${unsafeCSS(greenVars)} }
  :host(.theme-red)       { ${unsafeCSS(redVars)} }
  :host(.theme-aluminium) { ${unsafeCSS(aluminiumVars)} }
`;

export const DEFAULT_THEME: ThemeName = "amber";

export const ALL_THEMES: ThemeName[] = ["amber", "green", "red", "aluminium"];
