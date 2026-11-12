import { describe, expect, it } from "vitest";
import { LOCALES } from "./locale";
import { pickStarterName, STARTER_ADJECTIVES, STARTER_ANIMALS } from "./starterNames";

describe("starter-name lists", () => {
  it.each([
    ["animals", STARTER_ANIMALS],
    ["adjectives", STARTER_ADJECTIVES],
  ])("have about 20 %s with no empty or duplicate entries in either language", (_, list) => {
    expect(list.length).toBeGreaterThanOrEqual(18);
    for (const locale of LOCALES) {
      const words = list.map((word) => word[locale]);
      for (const word of words) expect(word.trim()).toBe(word);
      expect(words.every((word) => word.length > 0)).toBe(true);
      expect(new Set(words.map((word) => word.toLowerCase())).size).toBe(words.length);
    }
  });

  it("uses only gender-invariant Spanish adjectives, so every animal agrees with every adjective", () => {
    // Gendered Spanish adjectives end in -o / -a (valiento ✗, valiente ✓); invariant ones don't.
    for (const adjective of STARTER_ADJECTIVES) expect(adjective.es).not.toMatch(/[oa]$/i);
  });
});

describe("pickStarterName", () => {
  it("puts the adjective first in English and the animal first in Spanish", () => {
    expect(pickStarterName("en", () => 0)).toBe("Brave Otter");
    expect(pickStarterName("es", () => 0)).toBe("Nutria Valiente");
  });

  it("can reach the last animal and adjective", () => {
    const almostOne = () => 0.999999;
    const name = pickStarterName("en", almostOne);
    expect(name).toBe(`${STARTER_ADJECTIVES.at(-1)?.en} ${STARTER_ANIMALS.at(-1)?.en}`);
  });
});
