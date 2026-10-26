import { readFileSync } from "node:fs";

/** Node-only helpers to read token files in tests. */

export type TokenMap = Map<string, string>;

export function readTokenFile(file: string): TokenMap {
  return parseVariables(readFileSync(new URL(file, import.meta.url), "utf8"));
}

export function parseVariables(css: string): TokenMap {
  const variables: TokenMap = new Map();
  for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (name && value) variables.set(name, value.trim());
  }
  return variables;
}

/** Resolves a token to its final value, following `var(--…)` references through the theme and primitives. */
export function resolveToken(name: string, theme: TokenMap, primitives: TokenMap): string {
  const value = theme.get(name) ?? primitives.get(name);
  if (!value) throw new Error(`Undefined token: ${name}`);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference?.[1] ? resolveToken(reference[1], theme, primitives) : value;
}

export const primitives = readTokenFile("./primitives.css");
export const themes = {
  light: readTokenFile("./theme-light.css"),
  dark: readTokenFile("./theme-dark.css"),
};
