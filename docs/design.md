# Hogar design guide

Rules every Hogar interface must follow. The full rationale for each decision (why it is that way and how it helps the person) lives in Storybook, under **Foundations** (`packages/ui/src/docs/`). This document is the operational version: what to do and how to check it.

If something new doesn't fit these rules, there are no silent exceptions: justify it and update this guide (and the matching Foundations page).

## Emotional goal

**Warmth and comfort.** Opening Hogar should feel like walking into your home, not like opening your bank. The app deals with small but sensitive topics (money between people who live together, pending chores), so the interface must **lower tension, never raise it**. This holds in every language.

## Principles

| Principle | Concrete rule |
| --- | --- |
| Warmth over neutrality | Only the warm palette (sand, terracotta, sage, brick, amber). No cold greys, corporate blues or pure white backgrounds. |
| Calm: nothing shouts | Moderate saturation. No neon, no bright red, no ALL CAPS for emphasis, no flashy animations. |
| Friendly shapes | Rounded corners, soft warm shadows, generous white space. |
| Closeness in language | Copy sounds like someone who lives in the house, in natural sentences ("Ana owes you €12.50"). |
| Inclusive by default | AA contrast in both themes, visible focus, full keyboard use, color never alone, `prefers-reduced-motion` respected. |
| Visual fairness | No member stands out more than another: all member colors share the same luminance. |

## Color

Components use **only semantic tokens** (`--color-*`), never primitives (`--terracotta-600`, `--sand-50`…) or raw values.

| I need… | Token |
| --- | --- |
| App background | `--color-bg` |
| Card or panel | `--color-surface` |
| Sunken area (inputs, secondary sections) | `--color-surface-sunken` |
| Layer under dialogs | `--color-overlay` |
| Text | `--color-text` / `--color-text-muted` |
| Dividers | `--color-border` |
| Form field border | `--color-border-strong` |
| Primary action (background / text on top / hover) | `--color-accent` / `--color-accent-contrast` / `--color-accent-hover` |
| Links and accent text | `--color-accent-text` |
| Focus ring | `--color-focus` |
| Text selection (already applied globally in `base.css`) | `--color-selection-bg` / `--color-selection-text` |
| "Owes you", done, confirmation | `--color-positive` (+ `--color-positive-bg`) |
| "You owe", error, destructive action | `--color-negative` (+ `--color-negative-bg`) |
| Reminder, due soon | `--color-warning` (+ `--color-warning-bg`) |
| A member's identity | `--color-member-1…8` with `--color-member-text` on top |

Rules:
- **Color never goes alone:** every state comes with text, an icon or a sign.
- **Terracotta is for the primary action.** One primary action per screen or block.
- **Brick, not red:** errors and debts inform without alarming or blaming.
- **Deterministic member colors:** assigned by join order in the household; they never change between screens.
- **The brand is everywhere, Storybook included.** Storybook's chrome, docs pages and canvas use the brand themes in `packages/ui/.storybook/themes.ts` (light and dark, switched together by the Theme toolbar). Those themes mirror the palette as hex values; `storybookThemes.test.ts` fails if they drift from `primitives.css` or lose AA contrast. No default Storybook blues or greys, no backgrounds addon.

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
- Shadows only with `--shadow-sm|md|lg`.
- Mobile-first: design at 375 px first.

## Motion

- Durations only with `--duration-fast` (hover, press), `--duration-base` (menus, toasts, theme) and `--duration-slow` (dialogs, sheets).
- Easing `--easing-standard` or `--easing-gentle`. Nothing bounces or blinks.
- `prefers-reduced-motion` is already handled in `base.css`; don't override it from JavaScript.

## Internationalization

- **No hardcoded copy.** Every visible or accessible string (including `aria-label`, `alt`, `title`, placeholders, toasts and empty states) comes from i18n in `web`, or through props in `ui`.
- Every key exists in `en` and `es`. `en` is the source of truth.
- Money, dates and numbers with `Intl` and the active locale (`€12.50` / `12,50 €`). Never build them by concatenating strings.
- Never concatenate translated fragments into a sentence: use one key with interpolation, so each language controls its own word order.
- Plurals with `_one` / `_other`, never `count === 1 ? … : …`.
- The warm tone is reviewed in **each** language, not just translated literally.

## Copy tone

| ✓ Yes | ✗ No |
| --- | --- |
| en: "Ana owes you €12.50" · es: "Ana te debe 12,50 €" | "Outstanding balance: +12.50" · "Saldo pendiente: +12,50 €" |
| en: "All square! Nobody owes anything" · es: "¡Todo al día! Nadie debe nada" | "0 debts" · "0 deudas" |
| en: "The list is empty. What's missing at home?" · es: "La lista está vacía. ¿Qué falta en casa?" | "Empty list" · "Lista vacía" |
| en: "We couldn't save the expense. Please try again." · es: "No hemos podido guardar el gasto. Inténtalo de nuevo." | "Error 500" |
| en: "Delete expense" · es: "Borrar gasto" | "OK" · "Aceptar" |

- Second person, short sentences.
- Errors explain what happened and what to do next, without blaming the person ("We couldn't…", never "You entered an invalid…").

## UX patterns

- **Empty states:** a friendly message + the next action, never a blank space.
- **Saving:** a short, visible confirmation ("Expense added").
- **Real time:** changes by other people show their name and member color ("Marta added milk").
- **Deleting:** a confirmation that names exactly what will be deleted, with a destructive button using a verb; initial focus on "Cancel". Or an undo option.
- **Money:** first *with whom*, then *how much*.

## Adding something new

- **New color:** primitive in `primitives.css` → semantic token in `theme-light.css` **and** `theme-dark.css` → if it's used with text or as a UI border, add the pair to `contrastPairs.ts`. The test fails if it's missing from a theme or doesn't meet AA. If Storybook's chrome should use it, add it to `palette` in `.storybook/themes.ts`.
- **Changed a palette value:** update the same hex in `.storybook/themes.ts` (the test will remind you).
- **New component:** a folder with `Component.tsx`, `.module.css`, `.test.tsx` (with axe) and `.stories.tsx`, documented with the five-section template from *Foundations › Documenting a component*: what it is and when to use it · why it's designed this way · how it helps the person · accessibility · variants. Docs and story copy are written in `en` and `es` and follow the Storybook **Locale** toolbar.
- **New Storybook docs page:** each language's prose inside `<Lang locale="en">` / `<Lang locale="es">`; any text in docs blocks as `{ en, es }`. Anything that previews a specific theme goes inside `ThemeSplit` (or Storybook's `<Unstyled>` with its own `data-theme`): the docs page's typography otherwise forces its own text colors and breaks contrast.
- **New copy:** key in `en` and `es` in the feature namespace.

## Design review checklist

Before calling done any task that touches the interface:

- [ ] Only semantic tokens; no hex, raw `px` or primitives in `*.module.css`.
- [ ] Reviewed in light and dark themes, in Storybook too (chrome, docs page and canvas switch together).
- [ ] AA contrast; new pairs added to `contrastPairs.ts`.
- [ ] No state conveyed by color alone.
- [ ] No hardcoded copy; every key exists in `en` and `es`.
- [ ] Copy reviewed in both languages for a warm tone; empty states and errors written.
- [ ] Layout holds with the longer language (no clipped or overflowing text).
- [ ] Money, dates and numbers formatted with `Intl` and the active locale.
- [ ] Visible focus, full keyboard use and touch targets ≥ 44 px.
- [ ] Animations use duration tokens and respect reduced motion.
- [ ] Component documented with "why" and "how it helps the person", in `en` and `es`.
- [ ] Storybook pages and stories switch correctly with the Locale toolbar.
- [ ] Any deviation from this guide is justified and the guide updated.

Quick style check:

```bash
grep -rnE '#[0-9a-fA-F]{3,6}|[0-9]px|--(terracotta|sand|sage|brick|amber|earth|member-(light|dark))-' --include='*.module.css' packages apps
```
