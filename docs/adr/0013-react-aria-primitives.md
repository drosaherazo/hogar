# 0013 · `react-aria` for accessible primitives, replacing Radix

- **Status:** accepted
- **Date:** 2026-11-15

## Context

ADR 0001 chose Radix primitives for complex interactive widgets, so accessibility behavior comes from a well-tested library while the look stays ours. `packages/ui` uses `@radix-ui/react-dialog` and `@radix-ui/react-dropdown-menu`.

Supporting every currency (ADR 0014) needs a searchable picker for about 155 currencies: an accessible combobox. Radix has no combobox primitive. ADR 0012 rules out adding a second primitives library beside Radix.

## Decision

- **`react-aria` (Adobe) replaces Radix** as the single source of accessible behavior in `packages/ui`. It gives keyboard, focus and screen-reader behavior tested with VoiceOver, NVDA, JAWS and TalkBack, mobile included; markup and styles stay ours, with CSS Modules and semantic tokens.
- **We use it through `react-aria-components`,** its unstyled component layer, which bundles the `react-aria` hooks with their `react-stately` state. It accepts our class names and custom children (such as a radio group of options inside a menu), which the bare hooks would make us rebuild by hand. Its hooks stay available from the same package for anything the components don't cover.
- **`Dialog` and `Menu` are migrated first,** in their own `chore` PR, keeping their public API and look, so their existing tests, stories and E2E specs pass unchanged. Radix leaves the project in that PR.
- The `Combobox` is built afterwards, in the currency feature, on `react-aria`'s combobox.

## Considered options

- **Keep Radix and add `react-aria` only for the combobox:** less work now, but two primitive libraries side by side, which ADR 0012 forbids.
- **Keep Radix and hand-build the combobox on its `Popover`:** one library, but the hardest accessibility behavior (keyboard, live announcements while filtering) becomes ours to get right.
- **`downshift`:** a lighter, well-known combobox hook, but it covers only that widget, not dialogs or menus, and is less proven on mobile screen readers.
- **The bare `react-aria` and `react-stately` hooks:** the same behavior, but menus would need their collections built by hand, for no gain in look or behavior.

## Consequences

- ADR 0001's "Radix primitives" decision is superseded by this one; the rest of 0001 stands.
- `packages/ui` gains `react-aria-components` as a dependency and loses the Radix packages.
- Future widgets (popovers, tabs, date pickers) come from `react-aria` too.
