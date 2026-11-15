import { describe, expect, it } from "vitest";
import { buildCurrencyTable } from "./currencyTable.mjs";

/** A trimmed-down `supplemental.currencyData` in CLDR's own shape. */
function cldr({ fractions = {}, region = {} }) {
  return { fractions: { DEFAULT: { _rounding: "0", _digits: "2" }, ...fractions }, region };
}

describe("buildCurrencyTable", () => {
  it("lists every currency in force and legal tender in some region, and nothing else", () => {
    const { currencies } = buildCurrencyTable(
      cldr({
        region: {
          FR: [{ EUR: { _from: "1999-01-01" } }, { FRF: { _from: "1960-01-01", _to: "2002-02-17" } }],
          CO: [{ COP: { _from: "1905-01-01" } }, { COU: { _tender: "false" } }],
          ZZ: [{ XAU: { _tender: "false" } }],
        },
      }),
      {},
    );
    expect(currencies).toEqual({ COP: { decimals: 2 }, EUR: { decimals: 2 } });
  });

  it("uses cash decimals when CLDR records them, ISO decimals otherwise, and 2 by default", () => {
    const { currencies } = buildCurrencyTable(
      cldr({
        fractions: {
          SEK: { _rounding: "0", _digits: "2", _cashRounding: "0", _cashDigits: "0" },
          JPY: { _rounding: "0", _digits: "0" },
          KWD: { _rounding: "0", _digits: "3" },
        },
        region: { SE: [{ SEK: {} }], JP: [{ JPY: {} }], KW: [{ KWD: {} }], US: [{ USD: {} }] },
      }),
      {},
    );
    expect(currencies).toEqual({
      JPY: { decimals: 0 },
      KWD: { decimals: 3 },
      SEK: { decimals: 0 },
      USD: { decimals: 2 },
    });
  });

  it("keeps Argentine pesos whole, the documented exception to CLDR", () => {
    const { currencies } = buildCurrencyTable(cldr({ region: { AR: [{ ARS: { _from: "1992-01-01" } }] } }), {});
    expect(currencies.ARS).toEqual({ decimals: 0 });
  });

  it("refuses to write a currency with decimals the app can't handle", () => {
    expect(() =>
      buildCurrencyTable(
        cldr({ fractions: { CLF: { _rounding: "0", _digits: "4" } }, region: { CL: [{ CLF: {} }] } }),
        {},
      ),
    ).toThrow(/CLF.*4/);
  });

  it("keeps a code CLDR withdrew as retired, with the decimals it had", () => {
    const { currencies } = buildCurrencyTable(
      cldr({ region: { HR: [{ EUR: { _from: "2023-01-01" } }, { HRK: { _from: "1994-05-30", _to: "2023-01-14" } }] } }),
      { EUR: { decimals: 2 }, HRK: { decimals: 0 } },
    );
    expect(currencies).toEqual({ EUR: { decimals: 2 }, HRK: { decimals: 0, retired: true } });
  });

  it("refuses to change the decimals of a code already in the table, which would change what stored amounts mean", () => {
    expect(() =>
      buildCurrencyTable(
        cldr({
          fractions: { SEK: { _rounding: "0", _digits: "2", _cashDigits: "0" } },
          region: { SE: [{ SEK: {} }] },
        }),
        { SEK: { decimals: 2 } },
      ),
    ).toThrow(/SEK.*2.*0/);
  });

  it("brings a retired code back when CLDR lists it again", () => {
    const { currencies } = buildCurrencyTable(cldr({ region: { XX: [{ ABC: {} }] } }), {
      ABC: { decimals: 2, retired: true },
    });
    expect(currencies).toEqual({ ABC: { decimals: 2 } });
  });

  it("maps each region to the first currency in force there, in CLDR's order, and skips regions with none", () => {
    const { regions } = buildCurrencyTable(
      cldr({
        region: {
          PA: [{ PAB: { _from: "1903-11-04" } }, { USD: { _from: "1903-11-18" } }],
          ZW: [{ ZWL: { _from: "2009-02-02", _to: "2024-08-31" } }, { ZWG: { _from: "2024-06-25" } }, { USD: {} }],
          CO: [{ COU: { _tender: "false" } }, { COP: {} }],
          SU: [{ SUR: { _from: "1961-01-01", _to: "1991-12-25" } }],
        },
      }),
      {},
    );
    expect(regions).toEqual({ CO: "COP", PA: "PAB", ZW: "ZWG" });
  });
});
