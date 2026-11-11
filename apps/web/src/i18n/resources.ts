import enAuth from "./locales/en/auth.json";
import enCommon from "./locales/en/common.json";
import enErrors from "./locales/en/errors.json";
import enExpenses from "./locales/en/expenses.json";
import enHome from "./locales/en/home.json";
import enHousehold from "./locales/en/household.json";
import esAuth from "./locales/es/auth.json";
import esCommon from "./locales/es/common.json";
import esErrors from "./locales/es/errors.json";
import esExpenses from "./locales/es/expenses.json";
import esHome from "./locales/es/home.json";
import esHousehold from "./locales/es/household.json";

/** `en` is the source of truth: its shape types every key (see i18next.d.ts). */
export const en = {
  common: enCommon,
  auth: enAuth,
  home: enHome,
  household: enHousehold,
  expenses: enExpenses,
  errors: enErrors,
};

/** `es` must have exactly the same keys; `i18n.test.ts` enforces it. */
export const es: typeof en = {
  common: esCommon,
  auth: esAuth,
  home: esHome,
  household: esHousehold,
  expenses: esExpenses,
  errors: esErrors,
};

export const resources = { en, es } as const;
export const NAMESPACES = Object.keys(en) as (keyof typeof en)[];
