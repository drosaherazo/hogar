import enAuth from "./locales/en/auth.json";
import enCommon from "./locales/en/common.json";
import enErrors from "./locales/en/errors.json";
import enHome from "./locales/en/home.json";
import esAuth from "./locales/es/auth.json";
import esCommon from "./locales/es/common.json";
import esErrors from "./locales/es/errors.json";
import esHome from "./locales/es/home.json";

/** `en` is the source of truth: its shape types every key (see i18next.d.ts). */
export const en = { common: enCommon, auth: enAuth, home: enHome, errors: enErrors };

/** `es` must have exactly the same keys; `i18n.test.ts` enforces it. */
export const es: typeof en = { common: esCommon, auth: esAuth, home: esHome, errors: esErrors };

export const resources = { en, es } as const;
export const NAMESPACES = Object.keys(en) as (keyof typeof en)[];
