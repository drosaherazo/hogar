/**
 * Which browser origins the API trusts (ADR 0002, extended by ADR 0010).
 *
 * `webOrigin` must match exactly. On `dev`, `previewPattern` also admits the project's Vercel previews:
 * an `https://` origin with a single `*` that stands for one or more of `[a-z0-9-]` (no dots, slashes
 * or colons), anchored at both ends. It is a wildcard rather than a regex because a regex in an env
 * file is easy to leave unanchored or unescaped, and that mistake is invisible in review.
 */
export function createOriginMatcher(
  webOrigin: string,
  previewPattern?: string,
): (origin: string | undefined) => boolean {
  const preview = previewPattern === undefined ? null : compilePattern(previewPattern);
  return (origin) => origin !== undefined && (origin === webOrigin || (preview?.test(origin) ?? false));
}

function compilePattern(pattern: string): RegExp {
  const [prefix = "", suffix = ""] = pattern.split("*");
  return new RegExp(`^${escapeRegExp(prefix)}[a-z0-9-]+${escapeRegExp(suffix)}$`);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
