# Implementation Plan: Vibrant palette, a joyful fuchsia identity

**Branch**: `feat/vibrant-palette` | **Date**: 2026-11-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-vibrant-palette/spec.md`

## Summary

Replace the warm palette (sand, terracotta, sage, brick, amber; brown dark mode) with a vibrant
one: a vivid fuchsia brand (`#EB2386`, deepened to `#C2126A` wherever white text sits on it),
plum-tinted clean neutrals (off-white `#FBF8FA` page, white cards, `#141016` dark), teal for
positive, orange-coral for negative, a cleaner amber for warnings, and eight equal-luminance member
colors with no pink.

The token architecture already isolates color in two theme files, so most of the change is
values. The parts with real design work are:

1. A `tone="brand"` prop on `Card` that redefines the semantic tokens inside it, which turns the
   home money card fuchsia and makes every existing piece inside it adapt.
2. A decorative direction icon next to the balance sentence.
3. Brand assets: logo, favicon and the browser-bar color.
4. Storybook's mirrored theme and the bilingual docs.
5. `docs/design.md`, plus ADR 0004 with before/after captures from a Cypress capture spec that CI
   never runs.

Every value is AA-checked in [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), CSS Modules, MDX (Storybook docs)

**Primary Dependencies**: React 19 + Vite (`apps/web`), `@hogar/ui` design system, Storybook 10,
lucide-react (existing), Cypress 16 (existing). **No new dependencies.**

**Storage**: N/A. Nothing is persisted; the existing `hogar-theme` localStorage key is unchanged.

**Testing**: Vitest + Testing Library + vitest-axe (`packages/ui`, `apps/web`), the token
contrast and parity tests, the Storybook theme sync test, and Cypress E2E (unchanged).

**Target Platform**: Evergreen browsers, mobile-first (375–390 px), light and dark themes,
forced-colors mode.

**Project Type**: pnpm monorepo web app. The change touches `packages/ui` and `apps/web`, plus
`docs/`.

**Performance Goals**: No runtime cost: same number of CSS custom properties ±4, no new assets
beyond recolored SVGs.

**Constraints**: WCAG AA for every text/UI pair in both themes; semantic tokens only in component
styles; no changes to copy, typography, radii, spacing, layout or motion; Storybook mirrors the
palette exactly.

**Scale/Scope**: 3 token files; 1 `ui` component gains a prop (`Card`); 1 page edited
(`HomePage`); 3 SVGs × 2 locations; `index.html` and `theme.ts` for the browser bar; Storybook
theme; 5 Foundations pages and 10 component docs (prose in `en` + `es`); `docs/design.md`;
ADR 0004 and a pointer in 0001; `CLAUDE.md` (one word).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._ (Constitution 3.0.0)

| Principle                            | Assessment                                                                                                                                                                                                                                                                                                                                                                                                                                  | Status |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **I. Small, Polished and Deployed**  | The full palette, docs, assets, tests and ADR ship in one PR. Within MVP scope: visual system only, no new features. Simplest design: values swap behind unchanged semantic names, and one scoped `tone` instead of new variants across components. No new packages or layers.                                                                                                                                                              | ✅     |
| **II. Domain Integrity**             | No money, split or balance logic touched. The balance sentence and its amounts are reused as is.                                                                                                                                                                                                                                                                                                                                            | ✅ N/A |
| **III. Server-Side Security**        | No API, auth or permission change. The guest view of the money card keeps today's server-driven `canEdit`.                                                                                                                                                                                                                                                                                                                                  | ✅ N/A |
| **IV. Tested by Default**            | Contrast pairs extended (4 brand pairs, both themes), member luminance and theme parity tests kept; Storybook theme sync test updated; `Card` brand tone gets a test with axe and a story; `HomePage` tests cover the card in owed/owing/square/guest/loading/error states; E2E must stay green. Format, lint, typecheck and tests gate completion.                                                                                         | ✅     |
| **V. Fully Internationalized**       | **New i18n keys: none** (en and es). The direction icon is decorative (`aria-hidden`) and adds no copy. Docs prose changes in both languages via `<Lang>`; contrast-table labels for the new pairs are `{ en, es }`.                                                                                                                                                                                                                        | ✅     |
| **VI. Joyful and Accessible Design** | This is the feature that implements the v3 goal: one vivid color used deliberately, debts in coral that inform without alarming, words before color. `docs/design.md` is rewritten and its checklist run at the end. Semantic tokens only; AA in both themes; color never alone (icon + words); white focus ring on the brand surface; brand everywhere including Storybook; bilingual component docs with evidence kept apart from intent. | ✅     |
| **Tech constraints**                 | `ui` still imports nothing from `shared` or the apps; `web → ui` only. CSS Modules + `clsx`; no Tailwind or CSS-in-JS. The Cypress capture spec uses the existing toolchain.                                                                                                                                                                                                                                                                | ✅     |
| **Workflow**                         | Spec-driven; feature branch `feat/vibrant-palette`; ADR 0004 records the decision; Conventional Commits without AI attribution.                                                                                                                                                                                                                                                                                                             | ✅     |

**Gate result (pre-research)**: PASS, no violations.

**Re-check after Phase 1 design**: PASS. The brand tone uses layer 3 of the existing token model
(scoped overrides) rather than a new abstraction. The capture spec lives outside the CI pattern
and adds only one `package.json` script. Neither needs Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-vibrant-palette/
├── plan.md              # This file
├── research.md          # Palette values, AA ratios and design decisions (R1–R10)
├── data-model.md        # Design-token model changes (no persisted data)
├── quickstart.md        # How to validate end to end
├── contracts/
│   └── card-brand-tone.md   # UI contract for Card tone="brand"
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/ui/
├── src/tokens/
│   ├── primitives.css         # new families: fuchsia, ink, plum, teal, coral, amber, members
│   ├── theme-light.css        # new values + 4 brand tokens
│   ├── theme-dark.css         # new values + 4 brand tokens
│   ├── contrastPairs.ts       # + 4 brand pairs
│   └── tokens.test.ts         # literal in contrastRatio test refreshed
├── src/components/Card/       # tone prop, .brand scoped overrides, test, story, mdx
├── src/components/*/*.mdx     # wording: Alert, Avatar, Badge, Button, Dialog, EmptyState, Menu, Select, TextField
├── src/components/{Alert,EmptyState}/*.tsx   # JSDoc wording only
├── src/docs/0{1,2,3,4,6}-*.mdx              # Foundations rewritten (en + es)
└── .storybook/
    ├── themes.ts              # palette, light/dark colors, sidebar icons
    └── assets/{favicon,hogar-mark-light,hogar-mark-dark}.svg

apps/web/
├── index.html                 # theme-color metas + pre-paint sync
├── public/{favicon,hogar-mark-light,hogar-mark-dark}.svg
├── src/theme/theme.ts         # keep theme-color in sync with the manual theme
├── src/pages/HomePage/        # MoneyCard: Card tone="brand", direction icon; tests
├── cypress/captures/palette.cy.ts   # before/after captures (not run in CI)
└── package.json               # "capture" script

docs/
├── design.md                  # joyful goal, principles, color rules, grep guard
└── decisions/
    ├── 0001-visual-system.md  # status: palette superseded by 0004
    ├── 0004-vibrant-palette.md
    └── assets/0004/{before,after}/*.png

CLAUDE.md                      # drop "warmth" from the Design review section
```

**Structure Decision**: Existing monorepo layout. Color stays in `packages/ui/src/tokens`, the
brand surface is a `ui` capability (`Card` tone) consumed by `apps/web`, and the docs and ADR
live in `docs/`. No new packages or folders except the capture spec and the ADR assets.

## Implementation order (for /speckit-tasks)

1. **Captures first**: add the capture spec and script, and take the **before** set on the
   current palette.
2. Primitives, both themes, brand tokens and contrast pairs; get `tokens.test.ts` green.
3. Storybook `themes.ts` mirror; get `storybookThemes.test.ts` green.
4. `Card` tone (component, CSS, test, story, mdx).
5. `HomePage` money card (tone and direction icon) and its tests.
6. Logo/favicon SVGs (both locations), theme-color metas and `theme.ts` sync.
7. Foundations and component docs (en + es); JSDoc wording.
8. `docs/design.md`, `CLAUDE.md` and ADR 0004 (+ 0001 pointer).
9. Take the **after** captures; run the full quickstart, the design-review checklist and the old-palette grep.

## Complexity Tracking

No constitution violations to justify.
