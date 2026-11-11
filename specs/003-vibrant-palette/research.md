# Research: Vibrant palette

All values below were checked with a WCAG 2.x contrast script, the same formula as
`packages/ui/src/tokens/contrast.ts`, before they were written down. Ratios are rounded to two
decimals.

## R1. The vivid brand fuchsia: `#EB2386` instead of `#E6197F`

- **Decision**: The vivid brand tone is `#EB2386`, a hair lighter than the interview's `#E6197F`.
- **Rationale**: FR-002 makes the vivid tone the dark theme's primary-button background with dark
  text. With the dark page color `#141016`, `#E6197F` reaches only 4.31:1 (AA text needs 4.5).
  `#EB2386` reaches 4.59:1 and looks practically identical. As a graphic it still clears 3:1 on
  the light page (3.89:1 on `#FBF8FA`), so it also works as the light theme's focus ring and logo
  background.
- **Alternatives considered**: keep `#E6197F` and use a lighter pink (`#F4519F`) for dark buttons.
  Rejected because it breaks the clarification "vivid tone on dark primary buttons" and adds a
  second "brand" pink. Shifting further (`#EC2A8A` or lighter) was rejected because it drifts
  toward the Pink Panther end, while the user chose the Barbie end.

## R2. Primitive families and names

- **Decision**: Replace the families `sand`, `earth`, `terracotta`, `sage` and `brick` with
  `fuchsia` (brand), `ink` (light neutrals, plum-tinted), `plum` (dark neutrals), `teal`
  (positive) and `coral` (negative). Keep the name `amber` (warning) with new values. Keep
  `member-light-1…8` and `member-dark-1…8` with new values.
- **Rationale**: Primitive names describe the color, so the old names would lie after the change
  (SC-002 also requires no references to the old palette). Only `amber` still describes its
  color. Semantic token names (`--color-*`) **do not change**, so no component or app stylesheet
  needs a rename. Only the values behind them change.
- **Alternatives considered**: neutral scale names (`--neutral-*`, `--brand-*`). Rejected because
  the existing system names families by color and the docs explain each family by name.

## R3. The palette (starting values, all AA-verified)

| Primitive       | Value                   | Primitive     | Value     |
| --------------- | ----------------------- | ------------- | --------- |
| `--fuchsia-50`  | `#fde8f2`               | `--plum-950`  | `#141016` |
| `--fuchsia-100` | `#fcd9ea`               | `--plum-900`  | `#1e1921` |
| `--fuchsia-300` | `#ff8cc4`               | `--plum-800`  | `#29222c` |
| `--fuchsia-400` | `#f4519f`               | `--plum-700`  | `#3e3443` |
| `--fuchsia-500` | `#eb2386` (vivid brand) | `--plum-500`  | `#857a8b` |
| `--fuchsia-600` | `#c2126a`               | `--plum-300`  | `#c3b8c7` |
| `--fuchsia-700` | `#9e0e56`               | `--plum-50`   | `#f7f2f8` |
| `--fuchsia-800` | `#760a40`               | `--teal-50`   | `#e3f5f1` |
| `--ink-0`       | `#ffffff`               | `--teal-300`  | `#5fd6c2` |
| `--ink-25`      | `#fbf8fa`               | `--teal-700`  | `#0f6f68` |
| `--ink-50`      | `#f4eff3`               | `--teal-950`  | `#0d2b28` |
| `--ink-100`     | `#e9e2e7`               | `--coral-50`  | `#fdebe2` |
| `--ink-400`     | `#8b7f88`               | `--coral-300` | `#ff9e6b` |
| `--ink-600`     | `#5d5360`               | `--coral-700` | `#b8400f` |
| `--ink-900`     | `#1f1a21`               | `--coral-950` | `#3a180a` |
| `--amber-50`    | `#fdf3d3`               | `--amber-700` | `#8a5a06` |
| `--amber-300`   | `#f5c542`               | `--amber-950` | `#33270a` |

Members (one luminance per theme; no hue between 290° and 350°, so nothing is pink or magenta):

| #            | Light (L ≈ 0.56, `ink-900` text ≥ 9.8:1) | Dark (L ≈ 0.086, `plum-50` text ≥ 6.9:1) |
| ------------ | ---------------------------------------- | ---------------------------------------- |
| 1 teal       | `#94d1c8`                                | `#1e5b53`                                |
| 2 sky        | `#a7cae4`                                | `#325670`                                |
| 3 periwinkle | `#bac2f8`                                | `#464f84`                                |
| 4 lavender   | `#d2bbf8`                                | `#5d4784`                                |
| 5 green      | `#96d4aa`                                | `#205e35`                                |
| 6 lime       | `#bacc8f`                                | `#46581b`                                |
| 7 yellow     | `#d3c596`                                | `#605222`                                |
| 8 apricot    | `#e0c0a3`                                | `#6d4b2f`                                |

During implementation (T012) the members were refitted to equal chroma as well as equal luminance (HSL chroma 0.24), because a saturated teal stood out next to a soft lavender. Any change is re-checked by
`tokens.test.ts`, which already enforces AA and a luminance spread below 0.1.

## R4. Semantic mapping and verified ratios

| Semantic token                        | Light                         | Dark                          |
| ------------------------------------- | ----------------------------- | ----------------------------- |
| `--color-bg`                          | `ink-25`                      | `plum-950`                    |
| `--color-surface`                     | `ink-0`                       | `plum-900`                    |
| `--color-surface-sunken`              | `ink-50`                      | `plum-800`                    |
| `--color-text` / `-muted`             | `ink-900` / `ink-600`         | `plum-50` / `plum-300`        |
| `--color-border` / `-strong`          | `ink-100` / `ink-400`         | `plum-700` / `plum-500`       |
| `--color-accent` / `-hover`           | `fuchsia-600` / `fuchsia-700` | `fuchsia-500` / `fuchsia-400` |
| `--color-accent-contrast`             | `ink-0`                       | `plum-950`                    |
| `--color-accent-text`                 | `fuchsia-600`                 | `fuchsia-300`                 |
| `--color-focus`                       | `fuchsia-500`                 | `fuchsia-500`                 |
| `--color-selection-bg` / `-text`      | `fuchsia-100` / `ink-900`     | `fuchsia-800` / `plum-50`     |
| `--color-positive` / `-bg`            | `teal-700` / `teal-50`        | `teal-300` / `teal-950`       |
| `--color-negative` / `-bg`            | `coral-700` / `coral-50`      | `coral-300` / `coral-950`     |
| `--color-warning` / `-bg`             | `amber-700` / `amber-50`      | `amber-300` / `amber-950`     |
| `--color-member-text`                 | `ink-900`                     | `plum-50`                     |
| **new** `--color-brand-surface`       | `fuchsia-600`                 | `fuchsia-600`                 |
| **new** `--color-brand-surface-hover` | `fuchsia-700`                 | `fuchsia-700`                 |
| **new** `--color-on-brand`            | `ink-0`                       | `ink-0`                       |
| **new** `--color-brand-tint`          | `fuchsia-50`                  | `fuchsia-50`                  |

Lowest ratio per existing `contrastPairs.ts` entry: light 3.37 (UI border on sunken, min 3) and
4.81 (error text on its background, min 4.5). Dark 3.79 (UI) and 4.59 (primary button label).
New brand-surface pairs: white on `fuchsia-600` 5.85, white on `fuchsia-700` 7.92, `fuchsia-600`
on white 5.85, `fuchsia-600` on `fuchsia-50` 5.02.

Shadows and the overlay keep their alpha scale and take the `ink-900` tint `rgb(31 26 33 / …)` in
light. Dark keeps black.

## R5. The money card: a scoped brand theme, not new component variants

- **Decision**: `Card` gets a `tone?: "default" | "brand"` prop. The `brand` tone paints
  `--color-brand-surface` and, inside the card, **redefines the semantic tokens** for its
  subtree: `--color-surface` → brand surface, `--color-surface-sunken` → brand surface hover,
  `--color-text`, `--color-text-muted`, `--color-accent-text`, `--color-border-strong`,
  `--color-focus` and `--color-accent` → on-brand (white), `--color-accent-contrast` → brand
  surface, `--color-accent-hover` → brand tint.
- **Rationale**: everything inside the card adapts with no new variants. `ActionLink primary`
  becomes white with fuchsia text, `secondary` becomes a white outline on fuchsia whose hover
  darkens, `Spinner` (`currentcolor`) turns white, the error text turns white, and the focus ring
  turns white so it shows on fuchsia (FR-012). This is layer 3 ("optional component variables")
  of the three-layer token model in ADR 0001, so no new concept is introduced.
- **Alternatives considered**: new `onBrand` variants on `Button` and `ActionLink`, plus one-off
  colors in `HomePage.module.css`. Rejected: more API surface, duplicated logic, and states
  (loading, error) could be missed.
- **Contrast coverage**: `contrastPairs.ts` gains the four brand pairs from R4, so the scoped
  combinations are tested in both themes like any other pair.

## R6. The direction icon

- **Decision**: In `MoneyCard`, the balance sentence is preceded by a decorative lucide icon:
  `ArrowDownLeft` (incoming) when owed, `ArrowUpRight` (outgoing) when owing, none when all
  square. It is wrapped in `aria-hidden="true"`.
- **Rationale**: lucide-react is already a dependency of `apps/web`. The sentence already says
  everything ("You owe…"), so the icon adds a second, non-color cue (FR-007, FR-010) and no copy
  (FR-014).
- **Alternatives considered**: a status pill or "+/−" signs. Rejected in the interview (pill) and
  by the design guide (no bare signs).

## R7. Mobile browser bar color

- **Decision**: Add two `<meta name="theme-color">` tags to `apps/web/index.html`, one with
  `media="(prefers-color-scheme: light)"` (`#fbf8fa`) and one for dark (`#141016`). Also keep
  them in sync with the app's manual theme switch in `apps/web/src/theme/theme.ts` `apply()`, and
  in the inline pre-paint script.
- **Rationale**: FR-015 requires the bar to match each theme. Media queries alone would ignore an
  explicit in-app choice that differs from the system setting.

## R8. Logo and favicon

- **Decision**: Keep the shape. The rounded square becomes `#eb2386` and the house becomes
  `#ffffff` in `favicon.svg`, `hogar-mark-light.svg` and `hogar-mark-dark.svg` (dark keeps the
  same colors so the brand is identical in both themes), in both `apps/web/public/` and
  `packages/ui/.storybook/assets/`.
- **Rationale**: white on the vivid tone is 4.10:1, well above the 3:1 required for graphics. One
  look across themes reinforces recognition.

## R9. Before/after screenshots without new tooling

- **Decision**: Add a Cypress capture spec in `apps/web/cypress/captures/palette.cy.ts`. It is
  outside the default `cypress/e2e/**` pattern, so CI never runs it. It reuses the existing
  stubbed API and Google session, visits home, balances, the expense form and login at the
  configured mobile viewport, in light and dark (setting `hogar-theme` in `localStorage`), and
  calls `cy.screenshot()`. A `capture` script runs it with
  `--config specPattern=cypress/captures/**/*.cy.ts`. "Before" images are taken **before any
  token change**, "after" images at the end. Both sets are copied to
  `docs/decisions/assets/0004/{before,after}/` and linked from the ADR and the PR.
- **Rationale**: no new dependency (constitution I). The data is deterministic, so both sets show
  the same content. The folder is named `captures`, not `screenshots`, because
  `**/cypress/screenshots/` is gitignored.
- **Alternatives considered**: driving headless Chromium over CDP against the real dev stack.
  Rejected because it needs a signed-in session and seeded data. Automated visual regression was
  rejected in the interview.

## R10. Documentation scope

- **Decision**: Rewrite `packages/ui/src/docs/02-Color.mdx` (51 old-palette mentions) and the
  goal and primitives passages of `01-Introduction.mdx`, in `en` and `es`. Adjust the wording in
  `03`, `04` and `06` and in the component docs that cite the old palette or "warmth" (`Alert`,
  `Avatar`, `Badge`, `Button`, `Card`, `Dialog`, `EmptyState`, `Menu`, `Select`, `TextField`),
  plus the JSDoc comments in `Alert.tsx` and `EmptyState.tsx`. Update the Storybook `palette`,
  `lightColors`, `darkColors` and `sidebarIconColors` (story = teal, document = amber).
- **Rationale**: FR-016. The Storybook theme test fails if `palette` drifts from
  `primitives.css`. Following the project's documentation rule, docs keep evidence-backed claims
  (contrast, legibility) separate from design intent (joyful, approachable).
