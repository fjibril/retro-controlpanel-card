/**
 * Inline font-size for a row, group or table `scale`. Every control is sized
 * in em, so this multiplies onto the panel's (and any enclosing) scale.
 * Empty when unset, 1 or not a positive number.
 */
export function scaleStyle(scale: number | undefined): string {
  return typeof scale === "number" && Number.isFinite(scale) && scale > 0 && scale !== 1
    ? `font-size: ${scale}em;`
    : "";
}
