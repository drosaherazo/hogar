# UI contract: `Card` brand tone (`@hogar/ui`)

## Props

```ts
interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article";
  padding?: "md" | "lg";
  elevated?: boolean;
  /** `brand` paints the card in the brand color: the single highlighted surface on a screen. */
  tone?: "default" | "brand"; // NEW, defaults to "default"
}
```

- `tone="default"` renders exactly as today, so existing usages are untouched.
- `tone="brand"` renders the card on `--color-brand-surface`, with no border tint, and redefines
  the semantic tokens below for **everything inside it**.

## Scoped token overrides (inside `tone="brand"`)

| Token inside the card                                       | Resolves to                   |
| ----------------------------------------------------------- | ----------------------------- |
| `--color-surface`                                           | `--color-brand-surface`       |
| `--color-surface-sunken`                                    | `--color-brand-surface-hover` |
| `--color-text`, `--color-text-muted`, `--color-accent-text` | `--color-on-brand`            |
| `--color-border`, `--color-border-strong`                   | `--color-on-brand`            |
| `--color-focus`                                             | `--color-on-brand`            |
| `--color-accent`                                            | `--color-on-brand`            |
| `--color-accent-contrast`                                   | `--color-brand-surface`       |
| `--color-accent-hover`                                      | `--color-brand-tint`          |

What follows for existing pieces, with no changes to them:

| Piece                             | Look inside the brand card                                  |
| --------------------------------- | ----------------------------------------------------------- |
| `ActionLink` / `Button` primary   | White with fuchsia label; brand-tint fill on hover          |
| `ActionLink` / `Button` secondary | White outline and label on fuchsia; darker fuchsia on hover |
| `ActionLink` / `Button` ghost     | White label                                                 |
| `Spinner` (`currentcolor`)        | White                                                       |
| Body and muted text               | White                                                       |
| `:focus-visible` ring             | White                                                       |

## Usage rule

At most **one** brand-tone card per screen. In the MVP it appears only on the home page money
summary (`apps/web/src/pages/HomePage/HomePage.tsx` › `MoneyCard`). States must not be shown in
`--color-positive` or `--color-negative` inside it: words and the decorative direction icon carry
the meaning.

## Guarantees (tests)

- `Card.test.tsx`: the brand tone applies its class, keeps the element and props, and passes axe.
- `contrastPairs.ts`: the four brand pairs meet AA in both themes.
- `Card.stories.tsx`: a `Brand` story containing a heading, a sentence, a primary and a
  secondary action, shown in both themes and both locales.
- `Card.mdx`: a bilingual "Brand tone" section (what it is, why, how it helps, accessibility,
  when not to use it).
