import { describe, expect, it } from "vitest";
import {
  categoryEmojiSchema,
  categoryNameSchema,
  createCategoryInputSchema,
  STARTER_CATEGORIES,
  updateCategoryInputSchema,
  updateCategorySplitInputSchema,
} from "./categories";
import { errorCodeFrom } from "./errors";

const codeOf = (result: { error?: { issues: readonly { message: string }[] } }) => errorCodeFrom(result.error);

describe("categoryNameSchema", () => {
  it("trims the name and accepts 1 to 30 characters", () => {
    expect(categoryNameSchema.parse("  Dog ")).toBe("Dog");
    expect(categoryNameSchema.safeParse("a".repeat(30)).success).toBe(true);
  });

  it("returns error codes, not sentences", () => {
    expect(codeOf(categoryNameSchema.safeParse(""))).toBe("category.name.required");
    expect(codeOf(categoryNameSchema.safeParse("   "))).toBe("category.name.required");
    expect(codeOf(categoryNameSchema.safeParse("a".repeat(31)))).toBe("category.name.too_long");
  });
});

describe("categoryEmojiSchema", () => {
  it.each([
    ["a house", "🏠"],
    ["a flag", "🇪🇸"],
    ["a skin tone", "👍🏽"],
    ["a ZWJ family", "👩‍👩‍👧"],
    ["an emoji with a variation selector", "❤️"],
  ])("accepts one emoji: %s", (_label, emoji) => {
    expect(categoryEmojiSchema.parse(emoji)).toBe(emoji);
  });

  it.each([
    ["letters", "ab"],
    ["two emoji", "🏠🛒"],
    ["a plain letter", "a"],
    ["a text smiley", ":)"],
    ["a digit", "1"],
  ])("refuses %s", (_label, value) => {
    expect(codeOf(categoryEmojiSchema.safeParse(value))).toBe("category.emoji.invalid");
  });

  it("treats an empty or blank emoji as none", () => {
    expect(categoryEmojiSchema.parse("")).toBeNull();
    expect(categoryEmojiSchema.parse("  ")).toBeNull();
  });
});

describe("category requests", () => {
  it("creates a category with an optional emoji", () => {
    expect(createCategoryInputSchema.parse({ name: " Dog " })).toEqual({ name: "Dog", emoji: null });
    expect(createCategoryInputSchema.parse({ name: "Dog", emoji: "🐶" })).toEqual({ name: "Dog", emoji: "🐶" });
    expect(createCategoryInputSchema.parse({ name: "Dog", emoji: null })).toEqual({ name: "Dog", emoji: null });
  });

  it("renames with the version it started from", () => {
    expect(updateCategoryInputSchema.safeParse({ name: "Bills", emoji: "💡", version: 2 }).success).toBe(true);
    expect(codeOf(updateCategoryInputSchema.safeParse({ name: "Bills", emoji: null }))).toBe("request.invalid");
  });

  it("validates a category's own split like the household's", () => {
    const weights = [
      { membershipId: "m-ana", weight: 1 },
      { membershipId: "m-bruno", weight: 1 },
    ];
    expect(updateCategorySplitInputSchema.safeParse({ version: 1, ownSplit: true, weights }).success).toBe(true);
    expect(updateCategorySplitInputSchema.safeParse({ version: 1, ownSplit: false }).success).toBe(true);

    const twice = [weights[0], weights[0]];
    expect(codeOf(updateCategorySplitInputSchema.safeParse({ version: 1, ownSplit: true, weights: twice }))).toBe(
      "split.members_changed",
    );
    const zeros = weights.map((entry) => ({ ...entry, weight: 0 }));
    expect(codeOf(updateCategorySplitInputSchema.safeParse({ version: 1, ownSplit: true, weights: zeros }))).toBe(
      "split.all_zero",
    );
    const tooHeavy = [{ membershipId: "m-ana", weight: 101 }];
    expect(codeOf(updateCategorySplitInputSchema.safeParse({ version: 1, ownSplit: true, weights: tooHeavy }))).toBe(
      "split.weight.invalid",
    );
  });
});

describe("STARTER_CATEGORIES", () => {
  it("has five categories, each with an emoji and an English and Spanish name", () => {
    expect(STARTER_CATEGORIES).toHaveLength(5);
    for (const category of STARTER_CATEGORIES) {
      expect(categoryEmojiSchema.parse(category.emoji)).toBe(category.emoji);
      expect(categoryNameSchema.parse(category.name.en)).toBe(category.name.en);
      expect(categoryNameSchema.parse(category.name.es)).toBe(category.name.es);
    }
  });
});
