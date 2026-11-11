/**
 * Balances and suggested payments. Pure functions over cents, shared by the API (which computes
 * balances from the database) and the web (which previews the effect of a payment), so both
 * always agree. Balances are never stored: they are recomputed from expenses and settlements.
 */

/** Per-person sums over a household's live expenses and settlements, in cents. */
export interface BalanceTotals {
  /** What each person paid in expenses. */
  paid: ReadonlyMap<string, number>;
  /** Each person's shares of expenses. */
  owed: ReadonlyMap<string, number>;
  /** Payments each person made to others. */
  sent: ReadonlyMap<string, number>;
  /** Payments each person received. */
  received: ReadonlyMap<string, number>;
}

/**
 * Each person's balance: `paid − owed + sent − received`. Positive means they are owed money,
 * negative means they owe. Every cent paid is a cent owed by someone, so the balances of a
 * household always add up to zero.
 */
export function netBalances({ paid, owed, sent, received }: BalanceTotals): Map<string, number> {
  const balances = new Map<string, number>();
  const add = (sums: ReadonlyMap<string, number>, sign: 1 | -1) => {
    for (const [userId, cents] of sums) balances.set(userId, (balances.get(userId) ?? 0) + sign * cents);
  };
  add(paid, 1);
  add(owed, -1);
  add(sent, 1);
  add(received, -1);
  return balances;
}

export interface SuggestedTransfer {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

/**
 * The payments that would bring every balance to zero. Greedy: the person who owes the most pays
 * the person owed the most as much as they can, and again until everyone is square. Each step
 * settles at least one person, so there are at most `n − 1` payments for `n` people with a
 * non-zero balance; people who owe only pay and people who are owed only receive.
 *
 * Ties keep the order given (current members in member order, then former members), so
 * everyone in the household sees the same list.
 */
export function suggestSettlements(balances: readonly { userId: string; balanceCents: number }[]): SuggestedTransfer[] {
  if (balances.reduce((sum, person) => sum + person.balanceCents, 0) !== 0) {
    throw new Error("suggestSettlements needs balances that add up to zero");
  }

  const open = balances.map((person, order) => ({ ...person, order }));
  // Largest amount first; on a tie, whoever comes first in the given order.
  const largest = (people: typeof open) =>
    people.reduce<(typeof open)[number] | undefined>((best, person) => {
      if (!best) return person;
      const difference = Math.abs(person.balanceCents) - Math.abs(best.balanceCents);
      return difference > 0 || (difference === 0 && person.order < best.order) ? person : best;
    }, undefined);

  const transfers: SuggestedTransfer[] = [];
  for (;;) {
    const debtor = largest(open.filter((person) => person.balanceCents < 0));
    const creditor = largest(open.filter((person) => person.balanceCents > 0));
    if (!debtor || !creditor) return transfers;

    const amountCents = Math.min(-debtor.balanceCents, creditor.balanceCents);
    transfers.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amountCents });
    debtor.balanceCents += amountCents;
    creditor.balanceCents -= amountCents;
  }
}

export type ViewerPartKind = "owes" | "lent" | "none";

export interface ViewerPart {
  kind: ViewerPartKind;
  amountCents: number;
}

/**
 * What an expense means for one person:
 * - `lent`: they paid, and others' shares add up to this much;
 * - `owes`: someone else paid, and this is their share;
 * - `none`: they aren't involved, or it nets to nothing for them (they paid only for themselves).
 */
export function viewerPart(
  expense: { paidById: string; amountCents: number; shares: readonly { userId: string; amountCents: number }[] },
  viewerId: string,
): ViewerPart {
  const myShare = expense.shares.find((share) => share.userId === viewerId)?.amountCents ?? 0;
  if (expense.paidById === viewerId) {
    const lent = expense.amountCents - myShare;
    return lent > 0 ? { kind: "lent", amountCents: lent } : { kind: "none", amountCents: 0 };
  }
  return myShare > 0 ? { kind: "owes", amountCents: myShare } : { kind: "none", amountCents: 0 };
}
