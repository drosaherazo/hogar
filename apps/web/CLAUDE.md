# apps/web

## i18n implementation

- Translations: `apps/web/src/i18n/locales/{en,es}/<namespace>.json`, one namespace per feature (`common`, `auth`, `household`, `expenses`, `tasks`, `shopping`). Keys are typed through i18next module augmentation.
- Keys like `expenses.empty.title`; plurals with i18next `_one` / `_other`; names and amounts through interpolation.
- `web` translates Zod error codes with a Zod error map.
- Setup lives in `apps/web/src/i18n/` (`createI18n`, `useLocalePreference`). `i18n.test.ts` checks `en`/`es` key parity, no empty values, and that every API error code has a message. ESLint runs `eslint-plugin-i18next` (`no-literal-string`) on JSX in `web` and `ui`.
