# 0003 · Default split: proportional by member weight, no household type, no shared pot

- **Status:** accepted
- **Date:** 2026-11-10

## Context

The constitution left one product decision open: should couple/family households split expenses proportionally (with a per-member `Membership.defaultShareBps`) or through a shared pot? It also had a household type (`COUPLE_FAMILY` / `SHARED_FLAT`) meant to change defaults.

While designing the household feature we found that:

- The type carried no behavior: every default it could change is covered by letting each household say how responsibility is shared.
- A list of percentages that must add up to 100 % becomes invalid every time someone joins or leaves, so the household would be blocked until an admin fixed it.
- Households care about the overall agreement ("Ana pays three quarters, Bruno one quarter"), not about a label for their relationship.

## Decision

- **Weights, not percentages.** Each `Membership` has an integer `weight` from 0 to 100. A household's default split is each member's weight divided by the sum of weights. The UI always shows the resulting percentage next to each weight.
- **Defaults on join:** `MEMBER` (and the household's creator) start with weight 1, `GUEST` with weight 0. A `MEMBER` may be set to 0 (lives there, doesn't pay).
- **Who edits:** only `ADMIN`, from the household settings ("Split" section). Everyone in the household can see it. When members change after the last weight edit, the section shows a banner asking admins to review the split.
- **From weights to money:** when an expense is split, weights become exact cents through the existing rule: shares add up to the total, and leftover cents go deterministically to the first members. That logic lives in `packages/shared`.
- **No household type.** A household has only a name.
- **No shared pot.** Out of scope; one model covers couples, families and flatmates.

## Consequences

- Joining or leaving never leaves the split in an invalid state; the remaining members keep their proportions.
- Expenses read the default split from member weights and can override it per expense (to be specified with the expenses feature).
- A household where every weight is 0 has no valid default split; the expenses feature must handle it (for example, by asking for an explicit split).
- Removing the household type removes a rule from the constitution (v2.0.0).
