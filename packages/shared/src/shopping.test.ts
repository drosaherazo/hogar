import { describe, expect, it } from "vitest";
import { errorCodeFrom } from "./errors";
import { addShoppingItemInputSchema, shoppingNameKey, shoppingSuggestionsQuerySchema } from "./shopping";

const codeOf = (result: { error?: { issues: readonly { message: string }[] } }) => errorCodeFrom(result.error);

describe("addShoppingItemInputSchema", () => {
  it("trims the name and the note", () => {
    expect(addShoppingItemInputSchema.parse({ name: "  Milk ", note: " lactose-free  " })).toEqual({
      name: "Milk",
      note: "lactose-free",
    });
  });

  it.each([
    ["missing", {}],
    ["null", { note: null }],
    ["empty", { note: "" }],
    ["only spaces", { note: "   " }],
  ])("has no note when it is %s", (_, note) => {
    expect(addShoppingItemInputSchema.parse({ name: "Milk", ...note })).toEqual({ name: "Milk", note: null });
  });

  it("takes names up to 50 characters and notes up to 100", () => {
    const input = { name: "a".repeat(50), note: "b".repeat(100) };
    expect(addShoppingItemInputSchema.parse(input)).toEqual(input);
  });

  it.each([
    ["an empty name", { name: "" }, "shopping.item.name.required"],
    ["a name of only spaces", { name: "   " }, "shopping.item.name.required"],
    ["a name longer than 50 characters", { name: "a".repeat(51) }, "shopping.item.name.too_long"],
    ["a note longer than 100 characters", { name: "Milk", note: "b".repeat(101) }, "shopping.item.note.too_long"],
    ["no name at all", {}, "request.invalid"],
  ])("refuses %s with an error code", (_, input, code) => {
    expect(codeOf(addShoppingItemInputSchema.safeParse(input))).toBe(code);
  });
});

describe("shoppingNameKey", () => {
  it.each([
    ["case", "MILK", "milk"],
    ["accents", "Plátanos", "platanos"],
    ["surrounding spaces", "  Milk  ", "milk"],
    ["inner spaces", "Oat   milk", "oat milk"],
    ["tabs and non-breaking spaces", "Oat\t\u00a0milk", "oat milk"],
  ])("ignores %s", (_, name, key) => {
    expect(shoppingNameKey(name)).toBe(key);
  });

  it("gives the same key to every way of writing the same thing", () => {
    const keys = new Set(
      ["Café con leche", " cafe CON  leche ", "CAFÉ con Leche", "Cafe\u0301 con leche"].map(shoppingNameKey),
    );
    expect([...keys]).toEqual(["cafe con leche"]);
  });

  it("folds ñ too, so someone typing without it still finds Piña", () => {
    expect(shoppingNameKey("Piña")).toBe(shoppingNameKey("pina"));
  });

  it("folds case the way people read it, beyond lower-casing", () => {
    expect(shoppingNameKey("Straße")).toBe(shoppingNameKey("STRASSE"));
  });

  it("keeps different names apart", () => {
    expect(shoppingNameKey("Milk")).not.toBe(shoppingNameKey("Milks"));
    expect(shoppingNameKey("Oat milk")).not.toBe(shoppingNameKey("Oatmilk"));
  });
});

describe("shoppingSuggestionsQuerySchema", () => {
  it("matches everything when nothing is typed", () => {
    expect(shoppingSuggestionsQuerySchema.parse({})).toEqual({ q: "" });
  });

  it("takes up to a name's length and refuses more", () => {
    expect(shoppingSuggestionsQuerySchema.parse({ q: "a".repeat(50) })).toEqual({ q: "a".repeat(50) });
    expect(codeOf(shoppingSuggestionsQuerySchema.safeParse({ q: "a".repeat(51) }))).toBe("request.invalid");
  });
});
