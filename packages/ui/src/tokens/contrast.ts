/** WCAG 2.x contrast helpers for hex colors (#rrggbb, or #rgb as CSS minifiers write it). */

const WEIGHTS = [0.2126, 0.7152, 0.0722] as const;

export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!match?.[1]) {
    throw new Error(`Unsupported color: ${hex}`);
  }
  // Production CSS shortens #ffffff to #fff, and the docs read colors from the built CSS.
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  const value = parseInt(digits, 16);
  const channels = [value >> 16, (value >> 8) & 0xff, value & 0xff];
  return channels.reduce((sum, channel, index) => {
    const srgb = channel / 255;
    const linear = srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    return sum + linear * (WEIGHTS[index] ?? 0);
  }, 0);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** WCAG AA minimums: 4.5 for body text, 3 for large text and UI components. */
export const AA_TEXT = 4.5;
export const AA_UI = 3;
