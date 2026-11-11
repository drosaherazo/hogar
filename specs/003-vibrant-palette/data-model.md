# Data model: Vibrant palette

This feature stores **no data**: no database tables, no API payloads and no persisted state. The
only "model" is the design-token model in `packages/ui/src/tokens/`. This file records how the
feature changes it.

## Token layers (unchanged structure, ADR 0001)

1. **Primitives** (`primitives.css`): raw color values, named by family. Only the themes use them.
2. **Semantic tokens** (`theme-light.css`, `theme-dark.css`): `--color-*`, the only colors that
   components and app styles may reference. Both themes MUST define exactly the same set
   (enforced by `tokens.test.ts`).
3. **Scoped overrides** (component CSS): a component may redefine semantic tokens for its own
   subtree. This feature uses it for the first time, in the `Card` brand tone.

## Changes

### Primitives

| Family         | Before                                | After            | Notes                                 |
| -------------- | ------------------------------------- | ---------------- | ------------------------------------- |
| Brand          | `terracotta-*`                        | `fuchsia-50…800` | `fuchsia-500` = vivid brand `#eb2386` |
| Light neutrals | `sand-*`                              | `ink-0…900`      | plum-tinted off-white to near-black   |
| Dark neutrals  | `earth-*`                             | `plum-50…950`    | plum-tinted near-black to off-white   |
| Positive       | `sage-*`                              | `teal-*`         |                                       |
| Negative       | `brick-*`                             | `coral-*`        | orange-coral, hue far from fuchsia    |
| Warning        | `amber-*`                             | `amber-*`        | same name, new values                 |
| Members        | `member-light-1…8`, `member-dark-1…8` | same names       | new values, no pink/magenta           |

The values are in [research.md › R3](./research.md#r3-the-palette-starting-values-all-aa-verified).

### Semantic tokens

- **Unchanged names, new values**: every existing `--color-*` token
  ([research.md › R4](./research.md#r4-semantic-mapping-and-verified-ratios)).
- **New tokens**, defined in both themes:

| Token                         | Meaning                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `--color-brand-surface`       | Background of the single large brand surface (the money card)           |
| `--color-brand-surface-hover` | Hover fill for outlined actions on the brand surface                    |
| `--color-on-brand`            | Text, icons, outlines and focus ring on the brand surface               |
| `--color-brand-tint`          | Hover fill for the inverted (white) primary action on the brand surface |

### Contrast pairs (`contrastPairs.ts`)

Existing pairs stay. New pairs (each checked in both themes, with labels in `en` and `es` for the
Storybook contrast table):

| Foreground              | Background                    | Minimum | Usage                                 |
| ----------------------- | ----------------------------- | ------- | ------------------------------------- |
| `--color-on-brand`      | `--color-brand-surface`       | AA text | Text and focus ring on the money card |
| `--color-on-brand`      | `--color-brand-surface-hover` | AA text | Outlined action on hover              |
| `--color-brand-surface` | `--color-on-brand`            | AA text | Inverted primary action label         |
| `--color-brand-surface` | `--color-brand-tint`          | AA text | Inverted primary action on hover      |

### Storybook mirror (`packages/ui/.storybook/themes.ts`)

`palette` lists exactly the primitives that Storybook's chrome uses, by their new names and hex
values. `storybookThemes.test.ts` checks each one against `primitives.css`.

## Validation rules (already enforced, unchanged)

- Every `contrastPairs` entry meets its minimum in both themes.
- Member colors have a relative-luminance spread below 0.1 in each theme.
- Both themes define the same token names.
- No hex values, raw `px` or primitive names in `*.module.css` (the grep guard in
  `docs/design.md`, updated with the new family names).
