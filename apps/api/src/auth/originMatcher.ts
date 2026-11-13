/** Decides whether a request's `Origin` header belongs to a browser origin the API trusts. */
export type OriginMatcher = (origin: string | undefined) => boolean;

/**
 * A preview origin pattern (ADR 0010): an `https://` origin whose host has exactly one `*`, with fixed
 * text on both sides of it inside the same label, e.g. `https://hogar-*-<scope>.vercel.app`. The fixed
 * text keeps a typo like `https://*.vercel.app` from trusting every site on a shared host.
 */
export function isPreviewOriginPattern(pattern: string): boolean {
  const [prefix, suffix, ...rest] = pattern.split("*");
  if (prefix === undefined || suffix === undefined || rest.length > 0) return false;
  if (!prefix.startsWith("https://") || prefix.endsWith("/") || suffix === "" || suffix.startsWith(".")) {
    return false;
  }
  const example = `${prefix}x${suffix}`;
  return URL.canParse(example) && new URL(example).origin === example;
}

/**
 * Trusts `webOrigin` exactly and, when given, every origin matching `previewPattern`, whose `*` stands
 * for one or more of `[a-z0-9-]` (never a dot, slash or colon), anchored at both ends.
 */
export function createOriginMatcher(webOrigin: string, previewPattern?: string): OriginMatcher {
  const preview = previewPattern === undefined ? null : compilePattern(previewPattern);
  return (origin) => origin !== undefined && (origin === webOrigin || (preview?.test(origin) ?? false));
}

function compilePattern(pattern: string): RegExp {
  if (!isPreviewOriginPattern(pattern)) throw new Error(`Not a preview origin pattern: ${pattern}`);
  const [prefix = "", suffix = ""] = pattern.split("*");
  return new RegExp(`^${escapeRegExp(prefix)}[a-z0-9-]+${escapeRegExp(suffix)}$`);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
