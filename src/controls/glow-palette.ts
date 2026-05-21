import type { GlowColor } from "../types.js";

/** Hex / rgba values for every selectable glow colour. Shared across controls
    that let the user override the glow tint (button, seven-segment, flip switch
    indicator). */
export interface GlowSwatch {
  /** Bright "lit" tone — what you see when the control is on. */
  on: string;
  /** Soft falloff used in the wide outer glow. */
  soft: string;
  /** Translucent tint of `on` used for the dim/off "plastic" appearance. */
  off: string;
  /** Suitable contrasting text colour when sitting on top of `on`. */
  text: string;
}

export const GLOW_PALETTE: Record<GlowColor, GlowSwatch> = {
  amber: { on: "#ffa033", soft: "rgba(255,160,51,0.25)", off: "rgba(255,160,51,0.07)", text: "#1a120a" },
  green: { on: "#6dff7a", soft: "rgba(109,255,122,0.25)", off: "rgba(109,255,122,0.07)", text: "#0e1a10" },
  red:   { on: "#ff3a2c", soft: "rgba(255,58,44,0.25)",  off: "rgba(255,58,44,0.07)",   text: "#1a0a09" },
  white: { on: "#f4f0e8", soft: "rgba(244,240,232,0.25)", off: "rgba(244,240,232,0.08)", text: "#1a1a1a" },
  blue:  { on: "#5ad7ff", soft: "rgba(90,215,255,0.25)", off: "rgba(90,215,255,0.08)",  text: "#0a1a22" },
};
