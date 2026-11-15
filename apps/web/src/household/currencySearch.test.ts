import { OFFERED_CURRENCY_CODES } from "@hogar/shared";
import { describe, expect, it } from "vitest";
import { createCurrencySearch } from "./currencySearch";

const english = createCurrencySearch(OFFERED_CURRENCY_CODES, "en");
const spanish = createCurrencySearch(OFFERED_CURRENCY_CODES, "es");

const codes = (results: ReturnType<typeof english>) => results.map((result) => result.code);

describe("createCurrencySearch", () => {
  it("lists every currency, named in the language and sorted the way it sorts, when nothing is typed", () => {
    const all = spanish("  ");
    expect(all).toHaveLength(OFFERED_CURRENCY_CODES.length);
    expect(all.find((result) => result.code === "JPY")).toEqual({ code: "JPY", name: "yen japonés" });
    const names = all.map((result) => result.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "es")));
  });

  it("finds currencies by part of their name, ignoring case", () => {
    expect(english("YEN")[0]).toEqual({ code: "JPY", name: "Japanese Yen" });
    expect(codes(english("dinar"))).toEqual(expect.arrayContaining(["KWD", "BHD", "JOD", "LYD", "TND", "IQD"]));
  });

  it("finds currencies by ISO code, in any case", () => {
    expect(codes(english("kwd"))).toEqual(["KWD"]);
    expect(english("USD")[0]).toEqual({ code: "USD", name: "US Dollar" });
  });

  it("ignores accents both ways", () => {
    expect(codes(spanish("yen japones"))).toEqual(["JPY"]);
    expect(codes(spanish("japón"))).toEqual(["JPY"]);
    expect(codes(english("colón"))).toEqual(expect.arrayContaining(["CRC"]));
  });

  it("finds a currency by the name of a country that uses it, and says which country matched", () => {
    expect(spanish("alemania")).toEqual([{ code: "EUR", name: "euro", country: "Alemania" }]);
    expect(english("ecuador")).toEqual([{ code: "USD", name: "US Dollar", country: "Ecuador" }]);
    expect(spanish("españa")).toEqual([{ code: "EUR", name: "euro", country: "España" }]);
    // "yen" is also in "Svalbard & Jan Mayen", which uses Norwegian kroner.
    expect(english("yen")).toEqual([
      { code: "JPY", name: "Japanese Yen" },
      { code: "NOK", name: "Norwegian Krone", country: "Svalbard & Jan Mayen" },
    ]);
  });

  it("says nothing about countries when the name or code already matched", () => {
    expect(english("kuwait")).toEqual([{ code: "KWD", name: "Kuwaiti Dinar" }]);
    expect(english("euro")).toContainEqual({ code: "EUR", name: "Euro" });
    expect(english("eur").find((result) => result.code === "EUR")).toEqual({ code: "EUR", name: "Euro" });
  });

  it("finds nothing for text that matches no currency or country", () => {
    expect(english("zzzz")).toEqual([]);
  });
});
