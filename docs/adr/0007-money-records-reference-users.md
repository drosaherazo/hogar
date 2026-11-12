# 0007 · Expenses, shares and payments reference users, not memberships

- **Status:** accepted
- **Date:** 2026-11-12 (recorded; decided with the expenses feature)

## Context

Leaving or being removed from a household deletes the person's `Membership` row, and `Membership.userId` is unique, which is how the "a user belongs to a single household" rule is enforced. Money history has to survive both: an expense Carla paid last month still counts after she moves out.

## Decision

`Expense.paidById`, `ExpenseShare.userId`, `Settlement.fromUserId` / `toUserId` and every `createdById` / `editedById` / `deletedById` reference `User`, and every expense and settlement row carries its `householdId`. A **former member** is a user who appears in a household's live expenses or payments without a current `Membership` in it; it is derived, never stored.

## Considered options

- **Soft-delete memberships (`leftAt`):** needs a partial unique index instead of the plain unique `Membership.userId`, and every households query would have to filter on it.
- **A separate persistent "person in household" table:** a new layer for the same result.

## Consequences

- Rejoining a household reconnects the person's earlier records automatically, because it is the same user.
- Data about _current_ members keys on `Membership` instead and disappears when they leave: category weights (ADR 0005) cascade away with the membership.
