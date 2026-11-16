# Hogar design guide

Rules every Hogar interface must follow. The full rationale for each decision (why it is that way and how it helps the person) lives in Storybook, under **Foundations** (`packages/ui/src/docs/`). This document is the operational version: what to do and how to check it.

If something new doesn't fit these rules, there are no silent exceptions: justify it and update this guide (and the matching Foundations page).

## Emotional goal

**Joyful and approachable.** Opening Hogar should feel young, light and friendly: one vivid fuchsia used with intention, set against clean, calm neutrals. The app deals with small but sensitive topics (money between people who live together, pending chores), so the interface must still **lower tension, never raise it**. The joy comes from the brand and the copy, never from alarming colors. This holds in every language.

## Principles

| Principle                           | Concrete rule                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One joyful color, used deliberately | Fuchsia is the only brand color: primary actions, focus, the logo and the one highlighted card per screen. Everything else uses the clean ink (light) and plum (dark) neutrals. |
| Nothing alarms                      | Debts and errors in coral, never red. No neon besides the brand, no ALL CAPS for emphasis, no flashy animations.                                                                |
| Friendly shapes                     | Rounded corners, soft shadows, generous white space.                                                                                                                            |
| Closeness in language               | Copy sounds like someone who lives in the house, in natural sentences ("Ana owes you €12.50").                                                                                  |
| Inclusive by default                | AA contrast in both themes, visible focus, full keyboard use, color never alone, `prefers-reduced-motion` respected.                                                            |
| Visual fairness                     | No member stands out more than another: all member colors share the same luminance.                                                                                             |

## Color

Components use **only semantic tokens** (`--color-*`), never primitives (`--fuchsia-600`, `--ink-25`…) or raw values.

| I need…                                                   | Token                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| App background                                            | `--color-bg`                                                                    |
| Card or panel                                             | `--color-surface`                                                               |
| Sunken area (inputs, secondary sections)                  | `--color-surface-sunken`                                                        |
| Layer under dialogs                                       | `--color-overlay`                                                               |
| Text                                                      | `--color-text` / `--color-text-muted`                                           |
| Dividers                                                  | `--color-border`                                                                |
| Form field border                                         | `--color-border-strong`                                                         |
| Primary action (background / text on top / hover)         | `--color-accent` / `--color-accent-contrast` / `--color-accent-hover`           |
| Links and accent text                                     | `--color-accent-text`                                                           |
| Focus ring                                                | `--color-focus`                                                                 |
| Text selection (already applied globally in `base.css`)   | `--color-selection-bg` / `--color-selection-text`                               |
| "Owes you", done, confirmation                            | `--color-positive` (+ `--color-positive-bg`)                                    |
| "You owe", error, destructive action                      | `--color-negative` (+ `--color-negative-bg`)                                    |
| Reminder, due soon                                        | `--color-warning` (+ `--color-warning-bg`)                                      |
| A member's identity                                       | `--color-member-1…8` with `--color-member-text` on top                          |
| The one highlighted card per screen (`Card tone="brand"`) | `--color-brand-surface` / `--color-on-brand` (+ `-hover`, `--color-brand-tint`) |

Rules:

- **Color never goes alone:** every state comes with text, an icon or a sign.
- **Fuchsia is for the primary action.** One primary action per screen or block; secondary actions stay neutral.
- **Coral, not red:** errors and debts inform without alarming or blaming, and never look like the brand.
- **One brand surface per screen.** Only the home money card uses `Card tone="brand"`. Inside it, meaning is carried by words and icons, never by state colors.
- **Members are never pink:** member colors avoid the brand's hue, so nobody looks like the brand or a debt.
- **Deterministic member colors:** assigned by join order in the household; they never change between screens.
- **The brand is everywhere, Storybook included.** Storybook's chrome, docs pages and canvas use the brand themes in `packages/ui/.storybook/themes.ts` (light and dark, switched together by the Theme toolbar). Those themes mirror the palette as hex values; `storybookThemes.test.ts` fails if they drift from `primitives.css` or lose AA contrast. No default Storybook blues or greys, no old palette, no backgrounds addon.

## Typography

- A single family: Figtree (`--font-family-base`).
- Sizes only from the `--font-size-xs…3xl` scale; 16 px body text (`--font-size-md`).
- Headings in `--font-weight-semibold`; avoid `bold` except for key figures.
- Amounts always with `font-variant-numeric: tabular-nums`.
- Leave room for translations: Spanish strings are often ~30 % longer than English. No fixed widths on text containers; buttons and labels must wrap or grow gracefully.

## Spacing and shape

- Spacing only with `--space-*` (4 px base). When in doubt, more space, not less.
- Touch targets at least 44 px tall.
- Radii: `sm` tags · `md` buttons and inputs · `lg` cards · `xl` dialogs and sheets · `full` avatars and badges.
- Shadows only with `--shadow-sm|md|lg` (soft, plum-tinted in light, black in dark).
- Mobile-first: design at 375 px first.

## Small screens

Most people use Hogar on a phone, often with one hand. 375 px is the design width; 320 px is the guaranteed minimum.

1. **Reflow at 320 px** (WCAG 2.2 1.4.10): no horizontal scrolling and no clipped text, checked in `es`. `small-screens.cy.ts` fails CI if a main page scrolls sideways.
2. **Text at 200 %** stays readable and usable: no fixed heights on containers with text. The same spec checks every main page at 375 px with text at 200 %; long words may break there, a page may not scroll sideways.
3. **Inputs at 16 px text** or more (`--font-size-md`), so iOS doesn't zoom on focus.
4. **The right keyboard:** `inputMode="decimal"` for amounts (`numeric` when the household's currency has no decimals; `useAmountField` gives the right one), `type="email"` and `autoComplete="email"` for addresses, `enterKeyHint` in forms. A field's enter key says what it does: `next` only with `moveToNextField` on the form, so it moves on instead of submitting; `done`, `send` or `go` when it submits.
5. **Touch targets** at least 44 px (`--size-touch`), with at least `--space-2` between adjacent ones. `small-screens.cy.ts` checks both on every main page at 375 px.
6. **Safe areas:** nothing fixed (tab bar, floating button, sheets) sits under the notch or the home indicator; pad it with `env(safe-area-inset-*)`.
7. **No hover dependency:** no meaning or action appears only on hover, and pressed states are visible on touch: `:active` (or react-aria's `[data-pressed]`) looks like `:hover`. The browser's grey tap flash is off in `base.css`, so every control needs one.
8. **One breakpoint, `48rem`**, written mobile-first: `@media (min-width: 48rem)`, in `rem` so it follows the person's zoom. A new breakpoint must be justified here.

Screenshots of every screen and dialog at 320 and 375 px, in both languages and themes: `pnpm --filter @hogar/web capture:small-screens` (not committed).

## Motion

- Durations only with `--duration-fast` (hover, press), `--duration-base` (menus, toasts, theme) and `--duration-slow` (dialogs, sheets).
- `--duration-ambient` is only for slow ambient loops (today, just the wake-up house), always with `--easing-gentle`, and the keyframes must end on a complete still frame, because that frame is what people with reduced motion see.
- Easing `--easing-standard` or `--easing-gentle`. Nothing bounces or blinks.
- `prefers-reduced-motion` is already handled in `base.css`; don't override it from JavaScript.

## Internationalization

- **No hardcoded copy.** Every visible or accessible string (including `aria-label`, `alt`, `title`, placeholders, toasts and empty states) comes from i18n in `web`, or through props in `ui`.
- Every key exists in `en` and `es`. `en` is the source of truth.
- Money, dates and numbers with `Intl` and the formatting locale: the active language plus the device region when they match (`€12.50` / `12,50 €`; `$ 85.000` in `es-CO`). Never build them by concatenating strings.
- Never concatenate translated fragments into a sentence: use one key with interpolation, so each language controls its own word order.
- Plurals with `_one` / `_other`, never `count === 1 ? … : …`.
- The friendly tone is reviewed in **each** language, not just translated literally.

## Copy tone

| ✓ Yes                                                                                                               | ✗ No                                                        |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| en: "Ana owes you €12.50" · es: "Ana te debe 12,50 €"                                                               | "Outstanding balance: +12.50" · "Saldo pendiente: +12,50 €" |
| en: "All square! Nobody owes anything" · es: "¡Todo al día! Nadie debe nada"                                        | "0 debts" · "0 deudas"                                      |
| en: "The list is empty. What's missing at home?" · es: "La lista está vacía. ¿Qué falta en casa?"                   | "Empty list" · "Lista vacía"                                |
| en: "We couldn't save the expense. Please try again." · es: "No hemos podido guardar el gasto. Inténtalo de nuevo." | "Error 500"                                                 |
| en: "Delete expense" · es: "Borrar gasto"                                                                           | "OK" · "Aceptar"                                            |

- Second person, short sentences.
- Errors explain what happened and what to do next, without blaming the person ("We couldn't…", never "You entered an invalid…").

## UX patterns

- **Empty states:** a friendly message + the next action, never a blank space.
- **Saving:** a short, visible confirmation ("Expense added").
- **Real time:** changes by other people show their name and member color ("Marta added milk").
- **Deleting:** a confirmation that names exactly what will be deleted, with a destructive button using a verb; initial focus on "Cancel". Or an undo option.
- **Money:** first _with whom_, then _how much_.
- **Wide screens:** pages read in one column of `--size-content-md`. A page whose cards read better side by side (Home, Balances) uses `AppShell width="wide"` and `Columns`: two columns from `48rem`, one in reading order below. The header's content lines up with the widest page, so nothing spreads edge to edge. No desktop-only screens.
- **Creating on a phone:** a screen whose main action creates something ("Add expense") shows it below `48rem` as an extended floating button, icon and label, above the tab bar at the trailing edge (`ActionLink floating`). It is the same link as on wider screens, so there is still one fuchsia action per screen, and the page keeps room so it never covers the last item.
- **Waiting:** say what is happening and roughly how long it takes, show honest stages instead of fake percentages, and never leave an endless spinner: after a limit, offer a way forward (`WakeUpScreen`).

## Adding something new

- **New color:** primitive in `primitives.css` → semantic token in `theme-light.css` **and** `theme-dark.css` → if it's used with text or as a UI border, add the pair to `contrastPairs.ts`. The test fails if it's missing from a theme or doesn't meet AA. If Storybook's chrome should use it, add it to `palette` in `.storybook/themes.ts`.
- **Changed a palette value:** update the same hex in `.storybook/themes.ts` (the test will remind you).
- **New component:** a folder with `Component.tsx`, `.module.css`, `.test.tsx` (with axe), `.stories.tsx` and a bilingual `.mdx` docs page, documented with the five-section template from _Foundations › Documenting a component_: what it is and when to use it · why it's designed this way · how it helps the person · accessibility · variants. Docs and story copy are written in `en` and `es` and follow the Storybook **Locale** toolbar.
- **New Storybook docs page:** each language's prose inside `<Lang locale="en">` / `<Lang locale="es">`; any text in docs blocks as `{ en, es }`. Anything that previews a specific theme goes inside `ThemeSplit` (or Storybook's `<Unstyled>` with its own `data-theme`): the docs page's typography otherwise forces its own text colors and breaks contrast.
- **New copy:** key in `en` and `es` in the feature namespace.

## Design review checklist

Before calling done any task that touches the interface:

- [ ] Only semantic tokens; no hex, raw `px` or primitives in `*.module.css`.
- [ ] Reviewed in light and dark themes, in Storybook too (chrome, docs page and canvas switch together).
- [ ] AA contrast; new pairs added to `contrastPairs.ts`.
- [ ] No state conveyed by color alone.
- [ ] No hardcoded copy; every key exists in `en` and `es`.
- [ ] Copy reviewed in both languages for a friendly, approachable tone; empty states and errors written.
- [ ] Fuchsia only for the primary action, focus and the one brand card; states in teal, coral and amber.
- [ ] Layout holds with the longer language (no clipped or overflowing text).
- [ ] Money, dates and numbers formatted with `Intl` and the formatting locale (language plus device region).
- [ ] Visible focus, full keyboard use and touch targets ≥ 44 px.
- [ ] No horizontal scrolling or clipped text at 320 px in `es`.
- [ ] Usable with text at 200 %; no fixed heights on containers with text.
- [ ] Inputs use 16 px text or more.
- [ ] Amount, email and form fields bring up the right keyboard and enter key.
- [ ] Adjacent touch targets at least `--space-2` apart.
- [ ] Nothing fixed sits under a notch or home indicator.
- [ ] Nothing depends on hover; pressed states visible on touch.
- [ ] The only width media query is `@media (min-width: 48rem)`.
- [ ] On wide screens lines stay a reading length: one `--size-content-md` column, or `Columns` on a `wide` page.
- [ ] Animations use duration tokens and respect reduced motion.
- [ ] Component documented with "why" and "how it helps the person", in `en` and `es`.
- [ ] Storybook pages and stories switch correctly with the Locale toolbar.
- [ ] Any deviation from this guide is justified and the guide updated.

Quick style check:

```bash
grep -rnE '#[0-9a-fA-F]{3,6}|[0-9]px|--(fuchsia|ink|plum|teal|coral|amber|member-(light|dark))-' --include='*.module.css' packages apps
```
