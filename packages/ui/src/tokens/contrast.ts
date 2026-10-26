/** WCAG 2.x contrast helpers for hex colors (#rrggbb). */

const WEIGHTS = [0.2126, 0.7152, 0.0722] as const;

export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) {
    throw new Error(`Unsupported color: ${hex}`);
  }
  const value = parseInt(match[1], 16);
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
