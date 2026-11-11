# 0005 · Expense categories can opt in to their own split weights

- **Status:** accepted
- **Date:** 2026-11-11
- **Extends:** [0003 · Default split: proportional by member weight](0003-proportional-split-by-weight.md)

## Context

ADR 0003 gave each household one default split: the members' weights. Real homes often have different agreements for different kinds of spending ("rent is half each, everything else follows income"). Today that means choosing "exact amounts" or "equally" on every such expense, every month.

The expense categories feature (`specs/004-expense-categories`) lets people label expenses. Since a category already says what an expense was for, it is the natural place to say how that kind of expense is shared, as long as nobody has to configure every category by hand.

## Decision

- **The household's weights stay the default.** Nothing changes for expenses without a category, or in a category that follows the household.
- **Opt-in per category.** A category either follows the household's split or uses its own, chosen by one box in the household settings. Ticking it gives the category one integer weight (0–100) per current member, starting as a copy of the household's weights. Unticking it, after a confirmation, discards those weights.
- **Same rules as the household split.** Weight 0 means no share; shares add up exactly to the amount; leftover cents go to the first members in join order. A category whose weights are all 0 has no default split, like a household whose weights are all 0. The logic lives in `packages/shared`.
- **Joining and leaving.** Someone who joins gets their household joining weight (1 for `MEMBER`, 0 for `GUEST`) in every category with its own split, and admins see a notice to review those splits. Someone who leaves loses their weight everywhere; the others keep their proportions.
- **Shares are fixed when saved.** Changing a category's weights, ticking or unticking its box, renaming or deleting it never changes an existing expense. Changing the category of an expense saved with the default split shows each person's share before and after and lets the person apply the new category's split (preselected) or keep the current shares.
- **Who edits.** Only `ADMIN` manages categories and their weights; everyone in the household can see them.

## Alternatives considered

- **No per-category split (labels only).** Simplest, but leaves the most common uneven agreement (rent vs. everything else) to manual exact amounts on every expense.
- **Every category always has its own weights.** Removes the box, but forces admins to maintain every category and to update all of them when the household's agreement changes.
- **Per-category percentages.** Rejected for the same reason as in 0003: percentages that must add up to 100 % become invalid whenever someone joins or leaves.
- **Recalculating existing expenses when weights change.** Rejected: balances would move without anyone editing an expense, which breaks the trust the app exists to build.

## Consequences

- The default split of an expense depends on its category, so the expense form must show which split applies and each person's percentage before saving.
- Category weights are stored data with their own permission and concurrency checks, and must stay consistent with membership changes.
- Changing an expense's category is the only edit where a label can move money; it is always previewed and explicit.
- Because the default split can now come from a category whose weights an admin may change at any moment, every request that saves fresh default shares (adding an expense, switching an edited expense to the default split, or applying a new category's split) carries the shares the person was shown, and the API refuses to save if its own computation differs (`specs/004-expense-categories/research.md`, R3).
- Totals and charts per category are left to the budgets and charts phase (v1.2), which can build on the category stored on each expense.
- The constitution's Principle II and MVP scope were amended to v3.1.0 to include this.
