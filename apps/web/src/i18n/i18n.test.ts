import { ERROR_CODES } from "@hogar/shared";
import { describe, expect, it } from "vitest";
import { en, es } from "./resources";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? { ...all, [path]: value } : { ...all, ...flatten(value, path) };
  }, {});
}

const flatEn = flatten(en as unknown as Tree);
const flatEs = flatten(es as unknown as Tree);

describe("translations", () => {
  it("es has exactly the same keys as en", () => {
    expect(Object.keys(flatEs).sort()).toEqual(Object.keys(flatEn).sort());
  });

  it.each([
    ["en", flatEn],
    ["es", flatEs],
  ])("%s has no empty values", (_, flat) => {
    const empty = Object.entries(flat).filter(([, value]) => value.trim() === "");
    expect(empty).toEqual([]);
  });

  it("keeps the same interpolation variables in both languages", () => {
    const variables = (text: string) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort();
    for (const [key, value] of Object.entries(flatEn)) {
      expect(variables(flatEs[key] ?? ""), key).toEqual(variables(value));
    }
  });

  it("has a message for every API error code", () => {
    for (const code of ERROR_CODES) {
      expect(flatEn[`errors.${code}`], code).toBeTruthy();
      expect(flatEs[`errors.${code}`], code).toBeTruthy();
    }
  });
});
