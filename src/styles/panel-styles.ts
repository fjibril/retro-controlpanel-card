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

  /* ---- Row grouping frames ----
     A row-group wraps the row's cells in a decorative frame. .group-inner
     re-creates the same flex layout the .row would otherwise have so the cells
     lay out identically inside the frame. */
  .row-group {
    position: relative;
    display: inline-flex;
    border-radius: 0.4em;
  }
  .group-inner {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: center;
    gap: 0.9em;
  }

  /* Embossed: a continuous etched line scribed into the faceplate, like the
     engraved labels - same colour and shadow treatment, just drawn as a
     rounded rectangle outline. No fill, no recess - the panel surface shows
     through unchanged inside the frame. */
  .row-group.group-embossed {
    padding: 0.55em 0.85em;
    border: 1px solid var(--retro-label-etched-color);
    border-radius: 0.5em;
    /* Same dark-below / light-above stroke pair the engraved labels use to
       sell their "cut into the metal" look. */
    box-shadow: var(--retro-label-etched-shadow);
  }

  /* Screwed: a separate metal plate bolted on TOP of the panel. Uses the
     lighter bezel finish so it reads as a different piece of metal, with a
     bright lit top edge, a dark bottom edge, and a real drop shadow falling
     onto the panel below. Corner screws hold it in place. */
  .row-group.group-screwed {
    padding: 0.9em 1.15em;
    background-color: var(--retro-panel-bezel);
    background-image:
      linear-gradient(180deg, rgba(255, 255, 255, 0.09), rgba(0, 0, 0, 0.1));
    border-radius: 0.3em;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.22),
      inset 0 -1px 0 rgba(0, 0, 0, 0.45),
      0 0.07em 0.14em rgba(0, 0, 0, 0.5),
      0 0.2em 0.5em rgba(0, 0, 0, 0.55);
  }
  /* Screws are smaller than the panel screws and pinned tightly to the corners. */
  .row-group.group-screwed .screw {
    width: 0.55em;
    height: 0.55em;
  }
  .row-group.group-screwed .screw.tl { top: 0.14em;    left: 0.14em; }
  .row-group.group-screwed .screw.tr { top: 0.14em;    right: 0.14em; }
  .row-group.group-screwed .screw.bl { bottom: 0.14em; left: 0.14em; }
  .row-group.group-screwed .screw.br { bottom: 0.14em; right: 0.14em; }

  /* Stencil: spray-painted L-brackets, no continuous border. */
  .row-group.group-stencil {
    padding: 0.55em 0.7em;
  }
  .row-group.group-stencil .bracket {
    position: absolute;
    width: 0.75em;
    height: 0.75em;
    border: 0 solid var(--retro-label-etched-color);
    opacity: 0.85;
    pointer-events: none;
    /* Soft halo so the brackets read as paint, not crisp ink. */
    filter:
      drop-shadow(0 0 0.06em rgba(255, 255, 255, 0.08))
      drop-shadow(0 0.04em 0.08em rgba(0, 0, 0, 0.45));
  }
  .row-group.group-stencil .bracket.tl {
    top: 0; left: 0;
    border-top-width: 0.14em; border-left-width: 0.14em;
    border-top-left-radius: 0.1em;
  }
  .row-group.group-stencil .bracket.tr {
    top: 0; right: 0;
    border-top-width: 0.14em; border-right-width: 0.14em;
    border-top-right-radius: 0.1em;
  }
  .row-group.group-stencil .bracket.bl {
    bottom: 0; left: 0;
    border-bottom-width: 0.14em; border-left-width: 0.14em;
    border-bottom-left-radius: 0.1em;
  }
  .row-group.group-stencil .bracket.br {
    bottom: 0; right: 0;
    border-bottom-width: 0.14em; border-right-width: 0.14em;
    border-bottom-right-radius: 0.1em;
  }

  .error {
    padding: 1em;
    color: #ff6b6b;
    font-family: var(--retro-label-dymo-font);
    font-size: 0.85em;
  }
`;
