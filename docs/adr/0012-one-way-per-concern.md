# 0012 · One way per concern

- **Status:** accepted
- **Date:** 2026-11-15

## Context

Supporting every currency needs a searchable currency picker, an accessible combobox. ADR 0001 chose Radix primitives for complex widgets, but Radix has no combobox. The quick fix would be a second primitives library just for that one component, documented as an exception: "Radix by default, something else where Radix falls short".

Each such exception looks cheap on its own, but they add up: two ways of doing the same thing means two sets of conventions to learn, two upgrade paths and two places where accessibility can break. In a portfolio project, a reviewer reads that as technical debt, however well it is documented.

## Decision

- **Each concern uses a single library or pattern across the codebase:** accessible primitives, styles, data fetching, validation and so on.
- **Adopting a new one means migrating every existing use,** in its own `chore` PR that lands before the feature that needs it. Two side by side, even as a documented exception, is not allowed.
- The constitution gets this as a MUST rule in _Technology and architecture_ (MINOR bump to 6.1.0).

## Considered options

- **Documented exceptions per case:** fastest each time, but turns the codebase into a patchwork that is harder to read, review and maintain.
- **Avoid new libraries and hand-build what is missing:** keeps one library, but moves the risk into our own code, which for accessibility behavior is exactly what ADR 0001 wanted to avoid.

## Consequences

- Choosing a library for a concern now means checking it covers the needs we can foresee, since switching later costs a full migration.
- The first application: Radix is replaced by `react-aria` across `packages/ui` (ADR 0013) before the currency combobox is built.
- A migration PR keeps the public API and look of what it migrates, so existing tests prove nothing broke.
