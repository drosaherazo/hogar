import type { Locale } from "@hogar/shared";
import { describe, expect, it } from "vitest";
import { createI18n } from "../i18n";
import { purchaseTitle } from "./purchaseTitle";

/** "N more" in `language`, from the real translations, as the form will pass it. */
function moreIn(language: Locale) {
  const t = createI18n({ lng: language }).getFixedT(language, "shopping");
  return (count: number) => t("purchaseTitle.more", { count });
}

const en = (names: readonly string[], locale = "en") => purchaseTitle(names, locale, moreIn("en"));
const es = (names: readonly string[], locale = "es") => purchaseTitle(names, locale, moreIn("es"));

describe("purchaseTitle", () => {
  it("names a single item", () => {
    expect(en(["milk"])).toBe("Milk");
    expect(es(["leche"])).toBe("Leche");
  });

  it("lists every item when they all fit, the way the locale joins a list", () => {
    expect(en(["milk", "eggs", "bread"])).toBe("Milk, eggs, and bread");
    expect(en(["milk", "eggs", "bread"], "en-GB")).toBe("Milk, eggs and bread");
    expect(es(["leche", "huevos", "pan"])).toBe("Leche, huevos y pan");
    expect(es(["pan", "hilo"])).toBe("Pan e hilo");
  });

  it("names as many items as fit in 100 characters, in list order, then says how many more", () => {
    const enCart = [
      "semi-skimmed milk",
      "free-range eggs",
      "sourdough bread",
      "plain yoghurt",
      "cherry tomatoes",
      "basmati rice",
      "olive oil",
      "dish soap",
      "toilet paper",
    ];
    expect(en(enCart)).toBe(
      "Semi-skimmed milk, free-range eggs, sourdough bread, plain yoghurt, cherry tomatoes, and 4 more",
    );
    expect(en(enCart, "en-GB")).toBe(
      "Semi-skimmed milk, free-range eggs, sourdough bread, plain yoghurt, cherry tomatoes and 4 more",
    );

    const esCart = [
      "leche semidesnatada",
      "huevos camperos",
      "pan de masa madre",
      "yogur natural",
      "tomates cherry",
      "arroz basmati",
      "aceite de oliva",
      "lavavajillas",
      "papel higiénico",
    ];
    expect(es(esCart)).toBe(
      "Leche semidesnatada, huevos camperos, pan de masa madre, yogur natural, tomates cherry y 4 más",
    );
  });

  it("says one more in the singular", () => {
    const cart = ["a".repeat(40), "b".repeat(40), "c".repeat(40)];
    expect(en(cart)).toBe(`A${"a".repeat(39)}, ${"b".repeat(40)}, and 1 more`);
    expect(es(cart)).toBe(`A${"a".repeat(39)}, ${"b".repeat(40)} y 1 más`);
  });

  it("keeps a title of exactly 100 characters whole, and cuts one of 101", () => {
    const exactly100 = en(["a".repeat(45), "b".repeat(50)]);
    expect(exactly100).toBe(`A${"a".repeat(44)} and ${"b".repeat(50)}`);
    expect(exactly100).toHaveLength(100);

    expect(en(["a".repeat(46), "b".repeat(50)])).toBe(`A${"a".repeat(45)} and 1 more`);
  });

  it("never cuts a long name in half, nor skips one to fit a shorter one after it", () => {
    expect(en(["a".repeat(50), "b".repeat(50), "milk"])).toBe(`A${"a".repeat(49)} and 2 more`);
  });

  it("always names the first item, even before 99 more of the longest names", () => {
    const cart = Array.from({ length: 100 }, (_, index) => `${index}`.padEnd(50, "x"));
    expect(en(cart)).toBe(`0${"x".repeat(49)} and 99 more`);
    expect(es(cart)).toBe(`0${"x".repeat(49)} y 99 más`);
  });

  it("upper-cases only the first letter, leaving the rest as written", () => {
    expect(en(["milk", "IKEA bags"])).toBe("Milk and IKEA bags");
    expect(es(["ñoquis", "pan"])).toBe("Ñoquis y pan");
    expect(en(["🥛 milk", "eggs"])).toBe("🥛 milk and eggs");
  });
});
