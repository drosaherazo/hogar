# 0009 · The server decides every shopping list conflict

- **Status:** accepted
- **Date:** 2026-11-17

## Context

The shopping list is used by several people at once, often from a phone inside a shop with poor signal, sometimes with the screen locked between aisles. Two people can add, edit, mark or delete the same item at the same moment, and a weak signal makes one of them arrive seconds late. The product goal is quality of life: nobody loses what they wrote without being told, no item is ever left stuck, and a conflict handled well should feel like care rather than an error.

## Decision

The API is the single authority; clients show changes optimistically, the server accepts or rejects each one, and a change that is rejected or never reaches the server is rolled back with an explanation.

- **Edits** (name, note) carry the item's `version`, the same optimistic concurrency `Expense` and `ExpenseCategory` use. A stale edit is rejected and the person chooses between the other person's value and their own.
- **The cart is not an edit** and doesn't bump the version. An item is in at most one person's cart; the first request to reach the server wins and the other person is told whose cart it is in. While an item is in someone's cart, only that person can take it out, edit it or delete it; everyone else sees whose cart it is in. A forgotten cart is handled by reminding its owner, never by others emptying it. A cart empties back onto the list when its owner leaves the household or becomes a guest (who is told why), because nobody else could ever empty it.
- **Names are unique among items on the list**, ignoring case, accents and surrounding spaces. A duplicate add or rename is refused with a friendly notice and the option to keep the incoming note. Bought or deleted items don't count, so the same name can come back later as a new item.
- **Offline, the list is read-only** (ADR 0015): it shows the last list loaded, and adding, editing, marking, deleting and Finish shopping are disabled until the connection is back. Nothing is queued on the device.
- ADMIN and MEMBER have the same powers over the list; there is no "only whoever added it" rule.

## Considered options

- **Last write wins:** simplest, but silently drops one person's edit.
- **CRDTs or a sync engine:** merge without rejections, but add a library and a data model far beyond two short text fields, and still can't decide who bought the milk.
- **Locking an item while someone edits it:** leaves orphaned locks when a phone is locked or loses signal mid-edit.
- **Anyone may take an item out of someone else's cart, after confirming:** no item stays stuck, but it intrudes on what another person is carrying and races with their Finish shopping.
- **Private carts revealed at Finish shopping:** simpler, but two people buy the same thing, which a shared list exists to prevent.
- **Queuing changes on the device while offline:** the most useful in a shop without signal, but ADR 0015 rules it out for every kind of record.

## Consequences

- Every rejected change needs a human explanation in both locales; the API returns error codes that name the conflict (who holds the cart, the current value), never sentences.
- In a shop without signal people can read the list but not mark it; marking comes back with the signal.
- Whether WebSockets cross Vercel's rewrite to Render is answered by a prototype as the spec's first ticket; if they don't, ADR 0010's `api.` subdomain applies. Neither outcome changes these rules.
