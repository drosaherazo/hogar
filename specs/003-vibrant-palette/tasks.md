---
description: "Task list for the vibrant palette feature"
---

# Tasks: Vibrant palette, a joyful fuchsia identity

**Input**: Design documents from `specs/003-vibrant-palette/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/card-brand-tone.md](./contracts/card-brand-tone.md),
[quickstart.md](./quickstart.md)

**Tests**: Included. Constitution IV requires a test (with axe) and a story for every
`packages/ui` component change, AA contrast checks for every color pair, and green
format/lint/typecheck/tests before a task counts as done.

**Organization**: One phase per user story, in spec priority order. The old primitive families
(`sand`, `earth`, `terracotta`, `sage`, `brick`) stay in `primitives.css` until the Polish phase,
so each story can ship and pass its tests on its own. They are removed once nothing references
them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The user story the task belongs to (US1–US4)

---

## Phase 1: Setup (Before captures)

**Purpose**: Record the current look **before any color changes**, so the ADR can show before/after (FR-018, SC-005).

- [x] T001 Create the capture spec `apps/web/cypress/captures/palette.cy.ts`. Import the stub data and helpers already used by `apps/web/cypress/e2e/expenses.cy.ts` and `apps/web/cypress/support/e2e.ts`; extract any helper you need into `support/` rather than duplicating it. Stub a household with Ana (ADMIN), Bruno and one more member, plus balances where Ana is owed money. For each theme in `["light", "dark"]`, set `localStorage["hogar-theme"]` before the visit (`onBeforeLoad`). Visit and `cy.screenshot("<screen>-<theme>", { capture: "fullPage" })`: `login` (signed out), `home`, `balances` and `expense-form` (`/expenses/new`). That gives 4 screens × 2 themes = 8 images at the configured 390×844 viewport. Wait for the main heading of each screen before the screenshot.
- [x] T002 Add a `capture` script to `apps/web/package.json`: `start-server-and-test dev:e2e http://localhost:5174 "cypress run --spec cypress/captures/palette.cy.ts --config specPattern=cypress/captures/**/*.cy.ts"`. Check that `pnpm --filter @hogar/web typecheck` still passes (the Cypress tsconfig already includes `**/*.ts`).
- [x] T003 Run `env -u ELECTRON_RUN_AS_NODE pnpm --filter @hogar/web capture` on the **current** palette. Copy the 8 PNGs from `apps/web/cypress/screenshots/palette.cy.ts/` to `docs/decisions/assets/0004/before/` (names like `home-light.png`). Check that each image shows the expected screen and theme.

**Checkpoint**: The before set is committed (`chore(web): add palette capture spec and before screenshots`).

---

## Phase 2: Foundational (Blocking prerequisites)

**Purpose**: Add the new primitives and the four brand tokens that every story uses, without changing how anything looks yet, and update the design guide, so every review from US1 on checks against the new rules (constitution VI).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Add the new primitive families to `packages/ui/src/tokens/primitives.css` with the exact values from [research.md › R3](./research.md#r3-the-palette-starting-values-all-aa-verified): `--fuchsia-50 #fde8f2`, `-100 #fcd9ea`, `-300 #ff8cc4`, `-400 #f4519f`, `-500 #eb2386`, `-600 #c2126a`, `-700 #9e0e56`, `-800 #760a40`; `--ink-0 #ffffff`, `-25 #fbf8fa`, `-50 #f4eff3`, `-100 #e9e2e7`, `-400 #8b7f88`, `-600 #5d5360`, `-900 #1f1a21`; `--plum-950 #141016`, `-900 #1e1921`, `-800 #29222c`, `-700 #3e3443`, `-500 #857a8b`, `-300 #c3b8c7`, `-50 #f7f2f8`; `--teal-50 #e3f5f1`, `-300 #5fd6c2`, `-700 #0f6f68`, `-950 #0d2b28`; `--coral-50 #fdebe2`, `-300 #ff9e6b`, `-700 #b8400f`, `-950 #3a180a`. Add `--amber-50 #fdf3d3` and `--amber-950 #33270a` now. `--amber-700` and `--amber-300` change value in T009 and T022. Each family gets a one-line comment in the file's existing style ("Fuchsia: the brand. 500 is the vivid tone, 600+ carry white text"). Keep the old families for now.
- [x] T005 Add the four brand tokens to **both** `packages/ui/src/tokens/theme-light.css` and `packages/ui/src/tokens/theme-dark.css`, under a `/* Brand surface */` comment, with the same values in both themes: `--color-brand-surface: var(--fuchsia-600)`, `--color-brand-surface-hover: var(--fuchsia-700)`, `--color-on-brand: var(--ink-0)`, `--color-brand-tint: var(--fuchsia-50)`.
- [x] T006 Add four pairs to `packages/ui/src/tokens/contrastPairs.ts`, with `en` / `es` usage labels: `--color-on-brand` on `--color-brand-surface` (AA_TEXT, "Text and focus on the highlighted card" / "Texto y foco en la tarjeta destacada"), `--color-on-brand` on `--color-brand-surface-hover` (AA_TEXT, "Outlined action on the highlighted card, on hover" / "Acción con contorno en la tarjeta destacada, al pasar el ratón"), `--color-brand-surface` on `--color-on-brand` (AA_TEXT, "Main action on the highlighted card" / "Acción principal en la tarjeta destacada"), and `--color-brand-surface` on `--color-brand-tint` (AA_TEXT, "Main action on the highlighted card, on hover" / "Acción principal en la tarjeta destacada, al pasar el ratón"). Run `pnpm --filter @hogar/ui test -- tokens`: everything green, including theme parity.
- [x] T007 Update `docs/design.md`. Emotional goal: "joyful and approachable", with lowering tension kept. Principles table: replace "Warmth over neutrality" and "Calm: nothing shouts" with "One joyful color, used deliberately" (fuchsia only for primary actions, focus and the one highlighted surface; clean plum-tinted neutrals) and "Nothing alarms" (debts and errors in coral, never red; no neon besides the brand). Keep the other principles. Color table: add the four brand tokens with "the one highlighted card per screen". Rules: "Fuchsia is for the primary action", "Coral, not red", "Inside the brand card, meaning is carried by words and icons, never by state colors". Update the Storybook bullet. Grep guard: `--(fuchsia|ink|plum|teal|coral|amber|member-(light|dark))-`. Primitives example: `--fuchsia-600`, `--ink-25`. The guide's checklist itself is run in T041.

**Checkpoint**: The new primitives and brand tokens exist in both themes and pass AA, and `docs/design.md` already describes the new rules. The UI looks exactly as before.

---

## Phase 3: User Story 1 - The app feels new in the light theme (Priority: P1) 🎯 MVP

**Goal**: The light theme shows the new identity everywhere: off-white page, white cards, fuchsia primary actions, teal/coral/amber states and pink-free members.

**Independent Test**: In the light theme, open home, balances, expense form, login and settings. Only fuchsia is the brand, secondary actions are neutral, "you owe"/"owes you"/warnings read through color and words, and member avatars are distinct and pink-free. `tokens.test.ts` is green for the light theme.

### Tests for User Story 1

- [x] T008 [US1] In `packages/ui/src/tokens/tokens.test.ts`, replace the `#c4643f` literal in the `contrastRatio` "identical colors" assertion with `#eb2386`. Add a light-theme test asserting that no member color has a hue between 290° and 350° (FR-009). Compute the hue from the resolved hex in the test with a small local helper; don't add a dependency. The test fails until T010 lands.

### Implementation for User Story 1

- [x] T009 [US1] Remap every color in the light block of `packages/ui/src/tokens/theme-light.css` per [research.md › R4](./research.md#r4-semantic-mapping-and-verified-ratios): bg `ink-25`, surface `ink-0`, sunken `ink-50`, text `ink-900`, muted `ink-600`, border `ink-100`, border-strong `ink-400`, accent `fuchsia-600`, accent-hover `fuchsia-700`, accent-contrast `ink-0`, accent-text `fuchsia-600`, focus `fuchsia-500`, selection-bg `fuchsia-100`, selection-text `ink-900`, positive `teal-700`/`teal-50`, negative `coral-700`/`coral-50`, warning `amber-700`/`amber-50`, member-text `ink-900`. Overlay and shadows: replace `46 36 29` with `31 26 33` (`ink-900`) and keep every alpha. Update the header comment ("cool off-white with a hint of pink…"). `--amber-700` is used only by the light theme, so change its value to `#8a5a06` in `primitives.css`, and update the same hex for `"--amber-700"` in `palette` in `packages/ui/.storybook/themes.ts` so `storybookThemes.test.ts` stays green.
- [x] T010 [US1] Set `--member-light-1…8` in `packages/ui/src/tokens/primitives.css` to `#94d1c8`, `#a7cae4`, `#bac2f8`, `#d2bbf8`, `#96d4aa`, `#bacc8f`, `#d3c596`, `#e0c0a3` (research R3). Update the comment ("same luminance, dark text, no pink or magenta so no one looks like the brand or a debt").
- [x] T011 [US1] Run `pnpm --filter @hogar/ui test` and `pnpm --filter @hogar/web test`: contrast, member-luminance, hue and parity tests are green, and no component or page test regressed. If a value fails, adjust it within its family and record the new value in [research.md › R3](./research.md#r3-the-palette-starting-values-all-aa-verified).
- [x] T012 [US1] Review in the light theme (`pnpm dev` and `pnpm storybook` canvas), per [quickstart.md › 3](./quickstart.md#3-visual-review-in-the-app-us1us3): home, balances (coral debt vs teal credit vs fuchsia primary), expense form (errors coral with text), login, settings (8 avatars). Record any finding and fix it only through tokens. No component CSS changes are expected; if one seems necessary, raise it.

**Checkpoint**: The light theme is complete and shippable on its own.

---

## Phase 4: User Story 2 - The money card is the brand moment (Priority: P2)

**Goal**: The home money card is a fuchsia card: white sentence plus direction icon, inverted primary action, white-outlined secondary actions, readable loading and error states.

**Independent Test**: Open home as owed, owing, all square, guest, loading and load-error, in both themes. Each card state is readable and focus is visible on the fuchsia. `Card` and `HomePage` tests, including axe, are green.

### Tests for User Story 2

- [x] T013 [P] [US2] In `packages/ui/src/components/Card/Card.test.tsx`, add tests: `tone="brand"` adds the brand class; omitting `tone` or passing `"default"` does not; `as`, `padding`, `className` and `aria-*` props are still forwarded with the brand tone; and a brand card holding a heading, a paragraph and a `Button` (primary + secondary) has no axe violations.
- [x] T014 [P] [US2] In `apps/web/src/pages/HomePage/HomePage.test.tsx` (`with a household`), add tests: the money section is rendered as a brand-tone card; when owed, an incoming icon accompanies the sentence; when owing, an outgoing icon does; when all square, there is no icon. Query the icon wrapper with a `data-direction="in" | "out"` attribute on the `aria-hidden` wrapper. Also check that the icon is hidden from the accessibility tree (`aria-hidden="true"`) and the sentence text is unchanged. Keep the existing guest, loading, error and axe tests passing.

### Implementation for User Story 2

- [x] T015 [US2] Implement the brand tone in `packages/ui/src/components/Card/Card.tsx`: add `tone?: "default" | "brand"` (JSDoc: "`brand` paints the card in the brand color: the single highlighted surface on a screen. Use at most one per screen."), default `"default"`, and apply `styles.brand` through `clsx`. Per [contracts/card-brand-tone.md](./contracts/card-brand-tone.md).
- [x] T016 [US2] Add `.brand` to `packages/ui/src/components/Card/Card.module.css` with the scoped overrides from the contract, verbatim: `--color-surface: var(--color-brand-surface)`, `--color-surface-sunken: var(--color-brand-surface-hover)`, `--color-text`, `--color-text-muted` and `--color-accent-text: var(--color-on-brand)`, `--color-border` and `--color-border-strong: var(--color-on-brand)`, `--color-focus: var(--color-on-brand)`, `--color-accent: var(--color-on-brand)`, `--color-accent-contrast: var(--color-brand-surface)`, `--color-accent-hover: var(--color-brand-tint)`. Then `background-color: var(--color-surface)`, `color: var(--color-text)` and `border-color: var(--color-brand-surface)`. Add a comment explaining that the card re-themes its subtree so every child adapts. Semantic tokens only. Add a `@media (forced-colors: active)` rule keeping a visible `CanvasText` border.
- [x] T017 [US2] Add a `Brand` story to `packages/ui/src/components/Card/Card.stories.tsx`: a brand-tone card with a heading, a sentence and a primary + secondary `Button`, with copy per locale following the existing story-locale pattern (en "Money" / "You're owed €10.70 in total" / "Add expense" / "See balances"; es "Dinero" / "Te deben 10,70 € en total" / "Añadir gasto" / "Ver saldos").
- [x] T018 [US2] Document the brand tone in `packages/ui/src/components/Card/Card.mdx`, in both `<Lang locale="en">` and `<Lang locale="es">`, using the five-section template: what it is and when to use it (one highlighted surface per screen, e.g. the home money card); why (keep evidence such as the AA ratios and the white focus ring apart from intent such as the "brand moment" and joy); how it helps the person (the most important number stands out); accessibility (words carry the meaning, never the state colors inside it); variants (the `Brand` story embedded). Also fix the existing "warm" wording on that page.
- [x] T019 [US2] Update `MoneyCard` in `apps/web/src/pages/HomePage/HomePage.tsx`: pass `tone="brand"` to its `Card`, and render the balance as `<p className={styles.balance}>` with a leading `<span className={styles.direction} aria-hidden="true" data-direction=…>`. Use `ArrowDownLeft` (`data-direction="in"`) when `myBalanceCents > 0`, `ArrowUpRight` (`"out"`) when `< 0`, and no span when 0. Both icons come from `lucide-react`. Use `useBalanceSentence()` from `apps/web/src/expenses/BalanceSentence.tsx` for the text; don't change `BalanceSentence` for other pages. Add `.direction` (inline-flex, `--size-icon-md`, `margin-inline-end: var(--space-2)`, `vertical-align: middle`) and make `.balance` a flex row that wraps, in `apps/web/src/pages/HomePage/HomePage.module.css`. Semantic tokens only.
- [x] T020 [US2] Run `pnpm --filter @hogar/ui test` and `pnpm --filter @hogar/web test` (covers `packages/ui/src/components/Card/Card.test.tsx` and `apps/web/src/pages/HomePage/HomePage.test.tsx`) (T013 and T014 now pass). Review home in light **and** dark as owed, owing, square, guest, loading (throttle the network) and error, in `en` and `es`: the white sentence, the inverted "Add expense", the white-outlined links, wrapping of Spanish labels, and the Tab focus ring (white) on every action. Check forced-colors in DevTools.

**Checkpoint**: The money card works in both themes (the brand tokens are theme-independent), independent of US3.

---

## Phase 5: User Story 3 - The dark theme matches (Priority: P3)

**Goal**: The dark theme has a plum-tinted near-black, vivid fuchsia buttons with dark text, and the same clarity for states and members.

**Independent Test**: In the dark theme, repeat the US1 and US2 checks. Nothing brown remains, primary buttons are vivid fuchsia with dark text, and `tokens.test.ts` is green for dark.

### Tests for User Story 3

- [x] T021 [US3] Extend the member-hue test from T008 in `packages/ui/src/tokens/tokens.test.ts` to run for **both** themes, so it moves into the `describe.each` block.

### Implementation for User Story 3

- [x] T022 [US3] Remap the dark block of `packages/ui/src/tokens/theme-dark.css` per research R4: bg `plum-950`, surface `plum-900`, sunken `plum-800`, text `plum-50`, muted `plum-300`, border `plum-700`, border-strong `plum-500`, accent `fuchsia-500`, accent-hover `fuchsia-400`, accent-contrast `plum-950`, accent-text `fuchsia-300`, focus `fuchsia-500` (the vivid tone, 4.59:1 on the dark background), selection-bg `fuchsia-800`, selection-text `plum-50`, positive `teal-300`/`teal-950`, negative `coral-300`/`coral-950`, warning `amber-300`/`amber-950` (`--amber-300` is used only by the dark theme: change its value to `#f5c542` in `primitives.css` and mirror the hex in `palette` in `packages/ui/.storybook/themes.ts`), member-text `plum-50`. Overlay `rgb(0 0 0 / 0.55)` and black shadows stay. Update the header comment ("very dark plum instead of brown…").
- [x] T023 [US3] Set `--member-dark-1…8` in `packages/ui/src/tokens/primitives.css` to `#1e5b53`, `#325670`, `#464f84`, `#5d4784`, `#205e35`, `#46581b`, `#605222`, `#6d4b2f` (research R3).
- [x] T024 [US3] Run `pnpm --filter @hogar/ui test` (covers `packages/ui/src/tokens/tokens.test.ts`) and `pnpm --filter @hogar/web test`, then review every screen from T012 and the money card from T020 in the dark theme: plum background, vivid fuchsia buttons with dark labels, coral vs teal vs fuchsia distinguishable, and selected text readable.

**Checkpoint**: Both themes are complete.

---

## Phase 6: User Story 4 - The brand is consistent beyond the app screens (Priority: P4)

**Goal**: Favicon, logo, browser bar, Storybook chrome and docs, the design guide and project guidance all show and explain the new identity.

**Independent Test**: The favicon and logo are fuchsia; the mobile browser bar follows the theme (including a manual switch); Storybook in both themes and locales shows no old palette; `docs/design.md` and `CLAUDE.md` describe "joyful and approachable"; `storybookThemes.test.ts` is green.

### Tests for User Story 4

- [ ] T025 [P] [US4] Add a test in `apps/web/src/theme/theme.test.ts` (create it if it doesn't exist, following the repo's Vitest + jsdom setup): after `setThemePreference("dark")` every `meta[name="theme-color"]` has `content="#141016"`, and after `setThemePreference("light")` it is `#fbf8fa`. Create the two meta tags in the test's document setup. Also assert that `THEME_COLORS.light` and `THEME_COLORS.dark` equal `--ink-25` and `--plum-950` as read from `packages/ui/src/tokens/primitives.css` (read the file with `node:fs` and a regex; don't import `ui` internals), so a palette change can't leave the browser bar behind. The test fails until T027.

### Implementation for User Story 4

- [ ] T026 [P] [US4] Recolor the brand SVGs in `apps/web/public/` **and** `packages/ui/.storybook/assets/` (`favicon.svg`, `hogar-mark-light.svg`, `hogar-mark-dark.svg`): the `rect` fill becomes `#eb2386` and the house `path` fill becomes `#ffffff` in all six files. The shape does not change (research R8).
- [ ] T027 [US4] Browser bar (research R7): in `apps/web/index.html`, add `<meta name="theme-color" content="#fbf8fa" media="(prefers-color-scheme: light)" />` and `<meta name="theme-color" content="#141016" media="(prefers-color-scheme: dark)" />`, and extend the inline pre-paint script so that, after setting `data-theme`, it sets every `meta[name="theme-color"]` `content` to the resolved theme's color. In `apps/web/src/theme/theme.ts`, export `THEME_COLORS = { light: "#fbf8fa", dark: "#141016" } as const` with a comment "keep in sync with ink-25 / plum-950 in primitives.css and index.html". `apply()` sets every `meta[name="theme-color"]` to `THEME_COLORS[theme]`. T025 now passes.
- [ ] T028 [US4] Mirror the new palette in `packages/ui/.storybook/themes.ts`: rebuild `palette` with only the primitives used below (new names, exact hex from `primitives.css`). `lightColors`: primary/secondary `fuchsia-600`, appBg `ink-50`, appContentBg and appPreviewBg `ink-25`, appHoverBg and appBorderColor `ink-100`, text `ink-900`, muted `ink-600`, inverse `ink-0`, barBg `ink-0`, barText `ink-600`, barHover `fuchsia-700`, barSelected `fuchsia-600`, buttonBg `ink-0`, buttonBorder `ink-400`, booleanBg `ink-50`, booleanSelectedBg `ink-0`, inputBg `ink-0`, inputBorder `ink-400`, inputText `ink-900`. `darkColors`: primary/secondary `fuchsia-300`, appBg `plum-900`, content and preview `plum-950`, hover `plum-800`, border `plum-700`, text `plum-50`, muted `plum-300`, inverse `plum-950`, barBg `plum-950`, barText `plum-300`, barHover `fuchsia-400`, barSelected `fuchsia-300`, buttonBg `plum-800`, buttonBorder `plum-500`, booleanBg `plum-950`, booleanSelectedBg `plum-700`, inputBg `plum-800`, inputBorder `plum-500`, inputText `plum-50`. `sidebarIconColors`: light story `teal-700`, document `amber-700`; dark story `teal-300`, document `amber-300`, and update its comment ("teal and amber, the brand's closest equivalents"). Run `pnpm --filter @hogar/ui test -- storybookThemes`. If a pair fails, choose another palette step and note it in research.md.
- [ ] T029 [US4] Rewrite `packages/ui/src/docs/02-Color.mdx` in both `<Lang>` blocks. The intro presents the families (fuchsia brand, ink and plum neutrals, teal, coral, amber, members), followed by one section per swatch group (surfaces "clean off-white and white" / "dark plum"; text; accent "one joyful color, used deliberately"; states "coral, not red"; members "fair and pink-free"; brand surface, new swatches for the four brand tokens), each with **What it does / Why / How it helps the person**. Keep evidence (contrast ratios, glare, color-blind distinguishability of coral vs teal) apart from intent (joy, approachability). Keep `ColorSwatches`/`ContrastTable` usage; add a `brand` swatch list. Update the Storybook-chrome section. No mention of sand, terracotta, sage, brick or warmth.
- [ ] T030 [P] [US4] Rewrite the goal and token passages of `packages/ui/src/docs/01-Introduction.mdx` (en + es): the goal becomes "joyful and approachable" (constitution 3.0.0, still lowering tension around money and chores); the primitives example becomes `--fuchsia-600`; remove "walking into your home, not opening your bank" and every warm-palette wording.
- [ ] T031 [P] [US4] Fix the old-palette and "warmth" wording, en + es, in `packages/ui/src/docs/03-Typography.mdx`, `04-Spacing-and-shape.mdx` and `06-Documenting-a-component.mdx` (e.g. "what matters is that the tone survives", "warm shadows" → "soft shadows"). Change only the sentences that mention the old palette or warmth.
- [ ] T032 [P] [US4] Fix the old-palette and "warmth" wording, en + es, in the component docs `packages/ui/src/components/{Alert,Avatar,Badge,Button,Dialog,EmptyState,Menu,Select,TextField}/*.mdx` and the JSDoc comments in `Alert/Alert.tsx`, `EmptyState/EmptyState.tsx` and `apps/web/src/pages/LoginPage/LoginPage.tsx` ("Warm and brief" → "Friendly and brief") (e.g. "brick, not red" → "coral, not red"; "The warmth of the color is design intent" → "The joyful brand color is design intent"). Keep each page's evidence-vs-intent split.
- [ ] T033 [P] [US4] In `README.md`, rewrite line 3 ("**A warm, shared home organizer**") to "**A joyful, shared home organizer**" and the "**Warm by design.**" bullet (line 61) to "**Joyful by design.** One vivid color used deliberately, friendly shapes and copy that lowers the tension of talking about money and chores…", keeping the rest of each sentence (the reasoning in English and Spanish, etc.).
- [ ] T034 [P] [US4] In `CLAUDE.md` (Design review section), replace "warmth" in "(semantic tokens only, no hardcoded copy, warmth)" with "joyful, approachable tone", so it doesn't contradict constitution 3.0.0.
- [ ] T035 [US4] Run `pnpm storybook` (config in `packages/ui/.storybook/`) and review both themes and both locales: chrome, sidebar icons, Foundations pages (Color contrast table includes the four brand pairs) and the Card › Brand story. Check the favicon in the app tab and the browser-bar color with DevTools' device toolbar, including after a manual theme switch.

**Checkpoint**: The brand is consistent everywhere and documented.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Remove the old palette, record the decision with evidence, and run the full validation.

- [ ] T036 Take the **after** captures with `apps/web/cypress/captures/palette.cy.ts`: `env -u ELECTRON_RUN_AS_NODE pnpm --filter @hogar/web capture`, then copy the 8 PNGs to `docs/decisions/assets/0004/after/` with the same names as the before set.
- [ ] T037 Write `docs/decisions/0004-vibrant-palette.md` (status accepted, date). **Context**: the warm palette resembled Anthropic/Claude; constitution 3.0.0 set "joyful and approachable". **Decision**: one vivid fuchsia (`#EB2386`, deepened to `#C2126A` under white text), plum-tinted neutrals, teal/coral/amber, pink-free members, the `Card` brand tone as the single brand surface, recolored logo and the browser-bar color. **Consequences**: values only behind unchanged semantic names; one new scoped-override pattern; the vivid tone moved from `#E6197F` for dark-button AA. Add a before/after table embedding the 8 image pairs from `docs/decisions/assets/0004/`. State that it supersedes the palette parts of 0001.
- [ ] T038 Remove the old primitive families (`sand`, `earth`, `terracotta`, `sage`, `brick`) and the unused `--amber-100` / `--amber-900` from `packages/ui/src/tokens/primitives.css`, after confirming with grep that nothing references them. Run the old-palette greps from [quickstart.md › 2](./quickstart.md#2-no-old-palette-left-sc-002): no matches (SC-002).
- [ ] T039 [P] In `docs/decisions/0001-visual-system.md`, change the status to "accepted; palette superseded by [0004](./0004-vibrant-palette.md)" and add a note to the "Warm palette" bullet pointing to 0004. Don't rewrite the historical text.
- [ ] T040 Run the full validation in [quickstart.md](./quickstart.md): `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` (with `pnpm db:up` for the API tests), `env -u ELECTRON_RUN_AS_NODE pnpm --filter @hogar/web e2e`, and `pnpm -r build`. Everything must be green, with no test weakened or skipped (SC-004).
- [ ] T041 Run the `docs/design.md` design review checklist on every screen and component touched, in both themes and both languages (SC-003). Optionally run the `web-design-guidelines` skill on `packages/ui/src/components/Card` and `apps/web/src/pages/HomePage`. Do a side-by-side check against Anthropic/Claude (SC-006). Note the results in `specs/003-vibrant-palette/spec.md` under a new `### Design review 2026-11-XX` clarifications entry, following spec 002's convention.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. **Must run before any color change**, so the before captures show the old palette.
- **Foundational (Phase 2)**: after Setup. Blocks all user stories (new primitives, brand tokens and the updated design guide).
- **US1 (Phase 3)**: after Foundational.
- **US2 (Phase 4)**: after Foundational. It uses only the brand tokens, so it works on top of either the old or the new themes. Its review (T020) is most meaningful after US1.
- **US3 (Phase 5)**: after Foundational. T021 extends the test from T008 (US1), so do US1's T008 first or write the test for both themes directly.
- **US4 (Phase 6)**: after Foundational. The Storybook docs (T029–T032) describe the final palette, so do them after US1 and US3 values are settled. T026, T027, T028, T033 and T034 can start any time after Phase 2.
- **Polish (Phase 7)**: after all stories. T038 must come after US1 and US3 (nothing may still reference the old families), and T036 must come after everything visual.

### Within Each Story

- Tests first, failing where they assert new behavior (T008, T013, T014, T021, T025).
- Tokens before the review. Component before its story/docs (T015–T016 before T017–T018). The `Card` tone before the `HomePage` usage (T015–T016 before T019).

### Parallel Opportunities

- **Phase 4**: T013 ∥ T014 (different packages).
- **Phase 6**: T025 ∥ T026 ∥ T028 ∥ T030 ∥ T031 ∥ T032 ∥ T033 ∥ T034 (all different files). T029 should reuse the wording of `docs/design.md` (T007), for consistency.
- **Phase 7**: T039 ∥ T037.
- **Across stories**: once Phase 2 is done, US2 (`Card` + `HomePage`) and US4's asset tasks (T026–T028) can proceed alongside US1 (theme files).

---

## Parallel Example: User Story 4

```bash
Task: "Theme-color sync test in apps/web/src/theme/theme.test.ts"            # T025
Task: "Recolor the six brand SVGs in apps/web/public and .storybook/assets"  # T026
Task: "Mirror the new palette in packages/ui/.storybook/themes.ts"           # T028
Task: "Rewrite the goal and token passages of 01-Introduction.mdx"           # T030
Task: "Fix the wording in 03/04/06 Foundations pages"                        # T031
Task: "Fix the wording in nine component docs + two JSDoc comments"          # T032
Task: "Rewrite the 'warm' lines of README.md"                                # T033
Task: "Replace 'warmth' in CLAUDE.md's Design review section"                # T034
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: capture the before set (it cannot be redone later without checking out old code).
2. Phase 2: add the primitives and brand tokens.
3. Phase 3: the light theme. **Stop and validate**: the default experience already looks new.

### Incremental Delivery

1. Setup + Foundational → no visual change, tests green.
2. US1 → the light theme is new (MVP).
3. US2 → the money card brand moment.
4. US3 → the dark theme matches.
5. US4 → assets, Storybook, docs and guidance.
6. Polish → old palette removed, ADR with evidence, full validation, then one PR to `main`.

Commit after each task or logical group with Conventional Commits (e.g.
`feat(ui): add vibrant palette primitives and brand tokens`,
`feat(ui): add brand tone to card`, `feat(web): make the money card the brand moment`,
`docs(ui): rewrite color foundations for the vibrant palette`,
`docs(decisions): add ADR 0004 vibrant palette`).

---

## Notes

- Semantic token names never change. Only `primitives.css`, the two theme files, `Card` and
  `HomePage` touch color plumbing.
- If a reference value has to move to pass AA, change it in `primitives.css` **and** in
  [research.md](./research.md) (and in `themes.ts` if Storybook mirrors it).
- No new i18n keys. Docs prose always changes in both `<Lang>` blocks.
- Never weaken or skip a test to get green; fix the value instead.
