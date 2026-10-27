# 0001 · Visual system: warm design tokens, Radix primitives and bilingual docs

- **Status:** accepted
- **Date:** 2026-10-26

## Context

Hogar handles sensitive everyday topics (money between people who live together, chores). The interface should lower tension, feel warm and work for everyone: light and dark, English and Spanish, keyboard and screen readers. It's also a portfolio project, so the design decisions need to be visible and explained, not just applied.

## Decision

- **Design tokens in three layers** (`packages/ui/src/tokens/`): primitives (raw palette and scales) → semantic tokens per theme (`--color-accent`, `--color-negative`…) → optional component variables. Components only use semantic tokens, so dark mode is a redefinition of layer 2.
- **Warm palette:** sand, terracotta, sage, brick and amber; warm dark mode (dark browns, not grey-blue). Eight member colors with equal luminance.
- **Contrast enforced by tests:** every text/background pair used by the UI is listed in `contrastPairs.ts` and must meet WCAG AA in both themes; both themes must define the same tokens.
- **CSS Modules + `clsx`**, no CSS-in-JS or utility frameworks. A grep guard forbids raw hex, `px` and primitive tokens in component styles.
- **Radix primitives** for complex interactive widgets (menus, dialogs later), styled with our tokens. Accessibility behavior comes from a well-tested library; the look is ours.
- **Storybook as the source of truth**, fully bilingual: Foundations pages and one `Component.mdx` per component explain what it is, why it's designed that way and how it helps the person. Storybook's own chrome uses the brand themes and follows the Theme toolbar.
- **Self-hosted Figtree** font (`@fontsource`), no third-party font requests.

## Consequences

- Adding a color takes three steps (primitive, both themes, contrast pair), but the tests catch mistakes immediately.
- The Storybook theme mirrors the palette as hex values; `storybookThemes.test.ts` keeps them in sync.
- Writing docs in two languages doubles the prose, which is accepted: the warmth must hold in each language, not just be translated.
- The operational summary and review checklist live in `docs/design.md`.
