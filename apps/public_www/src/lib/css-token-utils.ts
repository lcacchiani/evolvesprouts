/**
 * Resolve a CSS custom property from the document root at runtime (client only).
 * Used when third-party APIs (e.g. Stripe Elements) need concrete color strings.
 */
export function resolveCssColorToken(
  cssVariableName: string,
  fallbackHex: string,
): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallbackHex;
  }
  const resolvedValue = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(cssVariableName)
    .trim();
  if (!resolvedValue) {
    return fallbackHex;
  }
  return resolvedValue;
}

const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX3 = /^#([0-9a-f]{3})$/i;

/**
 * Parse a hex color to RGB components. Returns null if the value is not a hex color.
 */
export function parseHexColorRgb(hex: string): { r: number; g: number; b: number } | null {
  const trimmed = hex.trim();
  const match6 = HEX6.exec(trimmed);
  if (match6) {
    const n = Number.parseInt(match6[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const match3 = HEX3.exec(trimmed);
  if (match3) {
    const [r, g, b] = match3[1].split('').map((c) => Number.parseInt(c + c, 16));
    return { r, g, b };
  }
  return null;
}

/**
 * Build `rgba(r, g, b, alpha)` from a resolved color string.
 * Supports `#rgb`, `#rrggbb`, and falls back to the accent color for non-hex inputs.
 */
export function rgbaFromCssColor(color: string, alpha: number, fallbackRgb: { r: number; g: number; b: number }): string {
  const parsed = parseHexColorRgb(color);
  const { r, g, b } = parsed ?? fallbackRgb;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
