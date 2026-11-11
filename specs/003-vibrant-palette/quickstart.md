# Quickstart: validating the vibrant palette

How to check that the feature works end to end. The token values live in
[research.md](./research.md) and the money card contract in
[contracts/card-brand-tone.md](./contracts/card-brand-tone.md).

## Prerequisites

- `pnpm install` done. Docker running and `pnpm db:up` (for the API tests in the full check).
- In the Claude shell, unset `ELECTRON_RUN_AS_NODE` before running Cypress.

## 1. Automated checks (SC-001, SC-004, SC-007)

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
env -u ELECTRON_RUN_AS_NODE pnpm --filter @hogar/web e2e
pnpm -r build
```

Expected: everything green. In particular:

- `packages/ui/src/tokens/tokens.test.ts`: every contrast pair (including the four brand pairs)
  passes in light and dark, member luminance spread < 0.1, and both themes define the same tokens.
- `packages/ui/src/tokens/storybookThemes.test.ts`: the Storybook palette mirrors `primitives.css`.
- `Card.test.tsx`: the brand tone passes axe. `HomePage.test.tsx`: the money card renders its
  sentence in each balance state.
- `i18n.test.ts`: parity is unchanged (this feature adds no app keys).

## 2. No old palette left (SC-002)

```bash
grep -rnE -- '--(sand|earth|terracotta|sage|brick)-|#(a9502f|c4643f|e5906a|fffdf9|fbf7f2|1c1714)' \
  packages/ui/src packages/ui/.storybook apps/web/src apps/web/public apps/web/index.html docs/design.md
grep -rniE 'terracotta|terracota|\bsand\b|arena|\bsage\b|salvia|brick|ladrillo|warmth|calidez' \
  packages/ui/src apps/web/src README.md --include='*.mdx' --include='*.tsx' --include='README.md'
```

Expected: no matches. ADR 0001 keeps its historical text, and ADR 0004 is the only place that
names the old palette.

The design guide's style check (updated family names) also returns nothing:

```bash
grep -rnE '#[0-9a-fA-F]{3,6}|[0-9]px|--(fuchsia|ink|plum|teal|coral|amber|member-(light|dark))-' \
  --include='*.module.css' packages apps
```

## 3. Visual review in the app (US1–US3)

```bash
pnpm dev   # API + web; sign in with Google
```

In light and then dark (theme switch in the app), and in `en` and then `es`:

| Screen        | Check                                                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home          | Page off-white / plum-black, household card white / dark surface; **money card fuchsia** with a white sentence and direction icon (↙ owed, ↗ owing, none when square); "Add expense" white with fuchsia text, other links outlined in white; Tab shows a white focus ring on the card |
| Home as guest | Money card without the add action still looks complete                                                                                                                                                                                                                                |
| Balances      | Debts coral, credits teal, each with its sentence; the "Record this payment" primary action is fuchsia                                                                                                                                                                                |
| Expense form  | One fuchsia primary button; Cancel neutral; validation errors coral with text                                                                                                                                                                                                         |
| Login         | Fuchsia sign-in accents, no terracotta                                                                                                                                                                                                                                                |
| Settings      | Up to 8 member avatars, all distinct, none pink, equally prominent                                                                                                                                                                                                                    |

Also check:

- **Browser tab**: the favicon is the fuchsia Hogar mark.
- **Mobile browser bar**: the bar color follows the theme, including after switching the theme in
  the app.
- **Forced colors** (Windows High Contrast or DevTools › Rendering › forced-colors): buttons,
  the money card's actions and focus remain visible.

## 4. Storybook (US4)

```bash
pnpm storybook
```

- Switch the **Theme** toolbar: chrome, sidebar icons (teal stories, amber docs), docs pages and
  canvas all use fuchsia and ink/plum. No sand or brown remains.
- **Foundations › Color** in `en` and `es`: the new families, why each exists, and the contrast
  table including the brand pairs.
- **Card › Brand** story in both themes.

## 5. Docs and evidence (FR-017, FR-018, SC-005)

- `docs/design.md` describes "joyful and approachable", "one joyful color, used deliberately",
  fuchsia primary actions, coral for debts and the money card as the single brand surface.
- `docs/decisions/0004-vibrant-palette.md` exists, supersedes the palette part of 0001 (and 0001
  links to it), and shows 4 screens × 2 themes before/after from `docs/decisions/assets/0004/`.
- Re-capture the "after" set with:

```bash
env -u ELECTRON_RUN_AS_NODE pnpm --filter @hogar/web capture
```

The images land in `apps/web/cypress/screenshots/palette.cy.ts/`. Copy them to
`docs/decisions/assets/0004/after/`.
