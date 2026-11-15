import { describe, expect, it } from "vitest";
import {
  amountInputValue,
  CURRENCY_CODES,
  currency,
  currencyCodeSchema,
  isRetired,
  OFFERED_CURRENCY_CODES,
  offeredCurrencyCodeSchema,
  parseAmount,
  regionsUsing,
  suggestCurrency,
} from "./currency";
import { MAX_AMOUNT_UNITS } from "./expenses";

const EUR = currency("EUR");
const COP = currency("COP");
const KWD = currency("KWD");

/**
 * Every code the table has ever listed. Households may hold any of them, so this list only grows:
 * a regeneration that drops one fails here (ADR 0014: withdrawn codes become retired instead).
 */
const EVER_LISTED = `
  AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF
  CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ
  GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP
  LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR
  PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP
  SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XCG XOF XPF YER
  ZAR ZMW ZWG
`
  .trim()
  .split(/\s+/);

describe("the currency table generated from CLDR", () => {
  it("records the decimals people actually use: CLDR's cash decimals, then ISO, then documented exceptions", () => {
    const picked = ["EUR", "USD", "GBP", "MXN", "BRL", "JPY", "KRW", "COP", "CLP", "ARS", "HUF", "SEK", "CZK"] as const;
    const threes = ["KWD", "BHD", "JOD", "OMR", "TND", "LYD"] as const;
    expect(Object.fromEntries([...picked, ...threes].map((code) => [code, currency(code).decimals]))).toEqual({
      EUR: 2,
      USD: 2,
      GBP: 2,
      MXN: 2,
      BRL: 2,
      JPY: 0,
      KRW: 0,
      COP: 0,
      CLP: 0,
      // ISO says 2; nobody uses centavos (exception in the generator).
      ARS: 0,
      HUF: 0,
      // CLDR's cash decimals: no öre or haléř coins in circulation.
      SEK: 0,
      CZK: 0,
      KWD: 3,
      BHD: 3,
      JOD: 3,
      OMR: 3,
      TND: 3,
      LYD: 3,
    });
  });

  it("never loses a code it has listed", () => {
    expect(CURRENCY_CODES).toEqual(expect.arrayContaining(EVER_LISTED));
  });

  it("only has decimals the app can split and parse", () => {
    for (const code of CURRENCY_CODES) expect([0, 2, 3]).toContain(currency(code).decimals);
  });

  it("offers every code that is not retired, and refuses retired ones as a new choice while still reading them", () => {
    expect(OFFERED_CURRENCY_CODES).toEqual(CURRENCY_CODES.filter((code) => !isRetired(code)));
    expect(OFFERED_CURRENCY_CODES).toEqual(expect.arrayContaining(["EUR", "COP", "JPY", "KWD"]));
    for (const code of CURRENCY_CODES.filter(isRetired)) {
      expect(offeredCurrencyCodeSchema.safeParse(code).success).toBe(false);
      expect(currencyCodeSchema.parse(code)).toBe(code);
    }
  });

  it("refuses codes that aren't currencies anyone uses, as money.currency.invalid", () => {
    for (const code of ["XAU", "CLF", "HRK", "eur", ""]) {
      const result = offeredCurrencyCodeSchema.safeParse(code);
      expect(result.error?.issues[0]?.message).toBe("money.currency.invalid");
    }
  });
});

describe("parseAmount in a currency with two decimals", () => {
  it.each([
    ["42.80", 4280],
    ["42,80", 4280],
    ["42", 4200],
    ["0,5", 50],
    ["0.05", 5],
    [" 12,50 ", 1250],
    ["100000", 10_000_000],
    ["0.29", 29],
    ["1.1", 110],
  ])("reads %s as %i cents", (text, cents) => {
    expect(parseAmount(text, EUR)).toBe(cents);
  });

  it.each(["1.200", "1,234.56", "12.345", "", "   ", "-3", "abc", "12,", ".5", "1 000", "4e3"])(
    "refuses %s rather than guess",
    (text) => {
      expect(parseAmount(text, EUR)).toBeNull();
    },
  );

  it("refuses absurdly long numbers instead of losing precision", () => {
    expect(parseAmount("12345678901234567890", EUR)).toBeNull();
  });
});

describe("parseAmount in a currency without decimals (COP)", () => {
  it.each([
    ["85.000", 85_000],
    ["85,000", 85_000],
    ["85000", 85_000],
    ["1.234.567", 1_234_567],
    [" 30.000.000 ", 30_000_000],
    ["7", 7],
  ])("reads %s as %i whole pesos", (text, pesos) => {
    expect(parseAmount(text, COP)).toBe(pesos);
  });

  it.each(["12,50", "85.5", "85.0000", "1.23.456", ".500", "500.", "", "-3", "abc", "85 000"])(
    "refuses %s rather than misread centavos",
    (text) => {
      expect(parseAmount(text, COP)).toBeNull();
    },
  );

  it("refuses absurdly long numbers instead of losing precision", () => {
    expect(parseAmount("12345678901234567890", COP)).toBeNull();
  });
});

describe("parseAmount in a currency with three decimals (KWD)", () => {
  it.each([
    ["1.250", 1250],
    ["1,250", 1250],
    ["1.5", 1500],
    ["0,05", 50],
    ["0.005", 5],
    ["42", 42_000],
    [" 7,125 ", 7125],
    ["1000000", 1_000_000_000],
  ])("reads %s as %i fils", (text, fils) => {
    expect(parseAmount(text, KWD)).toBe(fils);
  });

  it.each(["1.2500", "1.250.000", "1,250.5", "12,", ".5", "", "-3", "abc", "1 250"])(
    "refuses %s rather than guess",
    (text) => {
      expect(parseAmount(text, KWD)).toBeNull();
    },
  );
});

describe("amountInputValue", () => {
  it("writes cents the way people type them in each language", () => {
    expect(amountInputValue(770, EUR, "en")).toBe("7.70");
    expect(amountInputValue(770, EUR, "es")).toBe("7,70");
    expect(amountInputValue(5, EUR, "en")).toBe("0.05");
    expect(amountInputValue(10_000_000, EUR, "es")).toBe("100000,00");
  });

  it("writes whole pesos as plain digits", () => {
    expect(amountInputValue(85_000, COP, "es")).toBe("85000");
    expect(amountInputValue(7, COP, "en")).toBe("7");
  });

  it("writes fils with all three decimals", () => {
    expect(amountInputValue(1250, KWD, "en")).toBe("1.250");
    expect(amountInputValue(5, KWD, "es")).toBe("0,005");
    expect(amountInputValue(MAX_AMOUNT_UNITS, KWD, "en")).toBe("1000000.000");
  });

  it("round-trips through parseAmount in every listed currency and language", () => {
    for (const code of CURRENCY_CODES) {
      for (const units of [1, 99, 100, 4280, 123_456, MAX_AMOUNT_UNITS]) {
        for (const language of ["en", "es"] as const) {
          expect(parseAmount(amountInputValue(units, currency(code), language), currency(code))).toBe(units);
        }
      }
    }
  });
});

describe("suggestCurrency", () => {
  it.each([
    [["es-CO"], "COP"],
    [["es-ES"], "EUR"],
    [["en-US"], "USD"],
    [["en-GB"], "GBP"],
    [["de-CH"], "CHF"],
    [["es-MX"], "MXN"],
    [["pt-BR"], "BRL"],
    [["es-PE"], "PEN"],
    [["es-CL"], "CLP"],
    [["es-AR"], "ARS"],
    [["fr-FR"], "EUR"],
    [["es-EC"], "USD"],
    [["ja-JP"], "JPY"],
    [["ar-KW"], "KWD"],
    [["hi-IN"], "INR"],
    [["es-PA"], "PAB"],
    [["en-ZW"], "ZWG"],
    [["zh-Hant-TW"], "TWD"],
  ])("suggests from the device region (%j → %s)", (languages, code) => {
    expect(suggestCurrency(languages)).toBe(code);
  });

  it("takes the first language whose region it knows", () => {
    expect(suggestCurrency(["es", "es-419", "es-CO", "en-US"])).toBe("COP");
  });

  it("suggests euros when no region is known or given", () => {
    expect(suggestCurrency(["en-AQ"])).toBe("EUR");
    expect(suggestCurrency(["es-419"])).toBe("EUR");
    expect(suggestCurrency(["es", "en"])).toBe("EUR");
    expect(suggestCurrency([])).toBe("EUR");
  });
});

describe("regionsUsing", () => {
  it("lists the regions where a currency is the one people spend, from CLDR", () => {
    expect(regionsUsing("USD")).toEqual(expect.arrayContaining(["US", "EC", "SV", "PR"]));
    expect(regionsUsing("EUR")).toEqual(expect.arrayContaining(["ES", "FR", "DE", "AD", "XK"]));
    expect(regionsUsing("KWD")).toEqual(["KW"]);
  });

  it("counts a region with several currencies only for the first one CLDR lists", () => {
    // Panama has balboas and US dollars; CLDR lists balboas first.
    expect(regionsUsing("PAB")).toEqual(["PA"]);
    expect(regionsUsing("USD")).not.toContain("PA");
  });
});
