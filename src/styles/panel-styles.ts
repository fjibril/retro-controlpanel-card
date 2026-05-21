import { css } from "lit";

/**
 * Card-level chrome and row layout. Control-specific styling lives with each
 * control component, but every component inherits the CSS custom properties
 * declared by the active theme on the card host.
 */
export const panelStyles = css`
  :host {
    display: block;
    /* Single scale knob - bumping --retro-scale resizes the whole panel. */
    --retro-scale: 1;
    font-size: calc(16px * var(--retro-scale));
    color: var(--retro-label-etched-color);
    font-family: var(--retro-label-etched-font);
  }

  .panel {
    position: relative;
    padding: var(--retro-panel-bezel-width);
    border-radius: var(--retro-panel-radius);
    background: var(--retro-panel-bezel);
    box-shadow:
      0 0.25em 0.6em rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .panel-inner {
    position: relative;
    padding: var(--retro-panel-inner-padding);
    border-radius: calc(var(--retro-panel-radius) - 0.2em);
    background: var(--retro-panel-bg);
    /* Brushed-metal speckle. */
    background-image:
      repeating-linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.015) 0px,
        rgba(255, 255, 255, 0.015) 1px,
        transparent 1px,
        transparent 3px
      ),
      var(--retro-panel-bg);
    box-shadow:
      inset 0 0.15em 0.4em rgba(0, 0, 0, 0.5),
      inset 0 -0.05em 0 rgba(255, 255, 255, 0.05);
  }

  /* Decorative corner screws - rendered as inline SVG (see renderScrew) for
     crisp edges at any size. This rule only positions the 1em SVG box in each
     corner; the look lives in the SVG itself. */
  .screw {
    position: absolute;
    width: 0.8em;
    height: 0.8em;
    line-height: 0;
    pointer-events: none;
    /* Sit above the inner surface so the frame screws are never painted over. */
    z-index: 2;
  }
  .screw svg {
    width: 100%;
    height: 100%;
    display: block;
    filter: drop-shadow(0 0.04em 0.08em rgba(0, 0, 0, 0.5));
  }
  /* Centred within the ~1.15em frame. */
  .screw.tl { top: 0.17em;    left: 0.17em; }
  .screw.tr { top: 0.17em;    right: 0.17em; }
  .screw.bl { bottom: 0.17em; left: 0.17em; }
  .screw.br { bottom: 0.17em; right: 0.17em; }

  /* Title row centres whatever style the title uses. */
  .title-row {
    text-align: center;
    margin: 0.2em 0 0.85em 0;
  }
  .title {
    font-size: 1.05em;
    text-transform: uppercase;
  }
  /* Engraved-into-the-metal look (default). */
  .title.title-etched {
    font-family: var(--retro-label-etched-font);
    letter-spacing: var(--retro-label-etched-tracking);
    color: var(--retro-label-etched-color);
    text-shadow: var(--retro-label-etched-shadow);
  }
  /* Embossed black Dymo tape across the top of the panel. */
  .title.title-dymo {
    display: inline-block;
    font-family: var(--retro-label-dymo-font);
    letter-spacing: var(--retro-label-dymo-tracking);
    color: var(--retro-label-dymo-color);
    background: var(--retro-label-dymo-bg);
    box-shadow: var(--retro-label-dymo-shadow);
    padding: 0.14em 0.8em;
    border-radius: 0.15em;
  }
  /* Plain text, no engraving or tape. */
  .title.title-none {
    font-family: var(--retro-label-etched-font);
    letter-spacing: var(--retro-label-etched-tracking);
    color: var(--retro-label-etched-color);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: var(--row-justify, center);
    gap: 0.9em;
  }

  /* Each control occupies a flex item; intrinsic min-sizes come from the
     control itself, so we just hand it a sane default. */
  .cell {
    display: flex;
    flex: 0 0 auto;
  }

  .error {
    padding: 1em;
    color: #ff6b6b;
    font-family: var(--retro-label-dymo-font);
    font-size: 0.85em;
  }
`;
