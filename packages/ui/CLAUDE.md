# packages/ui

## Components and Storybook

- `Button` is the reference component for folder layout, tests, stories and docs.
- `packages/ui` has no copy and exposes `LocaleProvider` / `useLocale()` only for formatting components.
- Storybook is fully bilingual and follows its **Locale** toolbar: MDX prose wrapped in `<Lang locale="en">` / `<Lang locale="es">`, docs blocks take `{ en, es }` values, stories get copy per locale. Only sidebar titles stay in English. See _Foundations › Documenting a component_.
- Storybook chrome, docs and canvas use the light/dark brand themes in `packages/ui/.storybook/themes.ts`, switched together by the Theme toolbar and kept in sync with `primitives.css` by `storybookThemes.test.ts`. AA contrast is checked in `packages/ui/src/tokens/tokens.test.ts`.
- The full design rationale lives in Storybook under Foundations (`packages/ui/src/docs/`); the rules and checklist in `docs/design.md`.
