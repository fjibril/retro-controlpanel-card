import { svg } from "lit";

/**
 * Shared seven-segment glyph rendering, used by the full display
 * (retro-seven-segment) and the tiny inline readout (retro-mini-segments).
 *
 * Each glyph is one SVG of straight stretched-hexagon segments. Lit segments
 * get class `seg-on`, unlit ones `seg-off`; the consuming component supplies
 * the fill colours for those classes.
 */

/** Standard 7-segment map. Keys are the rendered glyphs. */
export const SEGMENT_MAP: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
  " ": "",
};

/** Render a single glyph as an SVG of seven segments. */
export function digitSvg(ch: string) {
  const segs = SEGMENT_MAP[ch] ?? "";
  const on = (name: string) => (segs.includes(name) ? "seg-on" : "seg-off");
  return svg`
    <svg viewBox="0 0 50 80" preserveAspectRatio="xMidYMid meet"
         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <polygon class=${on("a")} points="15,4 35,4 38,7 35,10 15,10 12,7" />
      <polygon class=${on("b")} points="40,11 43,14 43,33 40,36 37,33 37,14" />
      <polygon class=${on("c")} points="40,44 43,47 43,66 40,69 37,66 37,47" />
      <polygon class=${on("d")} points="15,70 35,70 38,73 35,76 15,76 12,73" />
      <polygon class=${on("e")} points="10,44 13,47 13,66 10,69 7,66 7,47" />
      <polygon class=${on("f")} points="10,11 13,14 13,33 10,36 7,33 7,14" />
      <polygon class=${on("g")} points="15,37 35,37 38,40 35,43 15,43 12,40" />
    </svg>
  `;
}

/**
 * Format a number as right-aligned integer glyph tokens for a fixed-width
 * readout: space-padded, sign glued to the digits, dashes on overflow or a
 * null/non-finite value. (Decimal points are intentionally omitted - this is
 * for tiny readouts where every glyph counts.)
 */
export function integerTokens(value: number | null | undefined, digits: number): string[] {
  const blank = () => Array.from({ length: digits }, () => "-");
  if (value == null || !Number.isFinite(value)) return blank();
  const negative = value < 0;
  const intStr = String(Math.round(Math.abs(value)));
  const signed = (negative ? "-" : "") + intStr;
  if (signed.length > digits) return blank();
  return [...signed.padStart(digits, " ")];
}
