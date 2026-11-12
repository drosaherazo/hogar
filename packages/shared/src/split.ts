/** 100 % expressed in basis points. */
export const FULL_SHARE_BPS = 10000;

/**
 * Turns member weights into shares in basis points that add up to exactly 10000.
 *
 * Integer math only: each member gets `floor(10000 × weight / total)` and the leftover
 * basis points go one each to the first members, in the order given (the household's
 * member order). A weight of 0 always gets 0.
 *
 * Throws when there is nothing to split (no members, or every weight is 0): callers must
 * reject that case before asking for shares.
 */
export function weightsToBasisPoints(weights: readonly number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (weights.length === 0 || total <= 0) {
    throw new Error("weightsToBasisPoints needs at least one weight above 0");
  }

  const shares = weights.map((weight) => Math.floor((FULL_SHARE_BPS * weight) / total));
  let leftover = FULL_SHARE_BPS - shares.reduce((sum, share) => sum + share, 0);
  for (let index = 0; leftover > 0; index = (index + 1) % shares.length) {
    // Members with weight 0 never receive leftovers: they don't pay.
    if ((weights[index] ?? 0) > 0) {
      shares[index] = (shares[index] ?? 0) + 1;
      leftover -= 1;
    }
  }
  return shares;
}

/**
 * Splits an amount of cents in proportion to `weights`, so that the shares add up to exactly
 * `amountCents`. It is the cents version of `weightsToBasisPoints`, with the same rule:
 *
 * - each entry gets `floor(amount × weight / total)`, in integer math only;
 * - the leftover cents go one each to the first entries **with a weight above 0**, in the order
 *   given (the household's member order), so a weight of 0 always gets 0.
 *
 * Every split method uses it: the household's split (member weights), "equally" (weight 1 for
 * each chosen person) and rescaling an edited expense (its stored shares as weights). Amounts
 * and weights stay below 10^7, so their product stays far below 2^53 and the math is exact.
 *
 * Throws when there is nothing to split: no entries, every weight 0, or an amount that isn't
 * a positive whole number of cents.
 */
export function splitAmount(amountCents: number, weights: readonly number[]): number[] {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error("splitAmount needs a positive whole number of cents");
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (weights.length === 0 || total <= 0) {
    throw new Error("splitAmount needs at least one weight above 0");
  }

  const shares = weights.map((weight) => Math.floor((amountCents * weight) / total));
  let leftover = amountCents - shares.reduce((sum, share) => sum + share, 0);
  // Each share lost less than one cent to rounding, so there are fewer leftover cents than
  // entries with a weight above 0: one pass is enough.
  for (let index = 0; leftover > 0 && index < shares.length; index += 1) {
    if ((weights[index] ?? 0) > 0) {
      shares[index] = (shares[index] ?? 0) + 1;
      leftover -= 1;
    }
  }
  return shares;
}

/** A current member as the default split sees them, in the household's member order. */
export interface WeightedMember {
  membershipId: string;
  /** The member's weight in the household's split (0–100). */
  weight: number;
}

/** What the default split needs to know about an expense's category. */
export interface CategorySplit {
  ownSplit: boolean;
  /** One row per member while `ownSplit` is true; ignored otherwise. */
  weights: readonly { membershipId: string; weight: number }[] | null;
}

/**
 * The weights of an expense's default split, one per member in member order (research R2):
 * the category's own weights when it uses its own split, the household's weights otherwise
 * (no category, or a category that follows the household). Rows for people who are no longer
 * members are ignored, and a member without a row gets 0. `splitAmount` turns the result into
 * cents; when every weight is 0 there is no default split (`expense.split.no_default`).
 */
export function defaultWeights(members: readonly WeightedMember[], category: CategorySplit | null): number[] {
  if (!category?.ownSplit) return members.map((member) => member.weight);
  const own = new Map((category.weights ?? []).map((row) => [row.membershipId, row.weight]));
  return members.map((member) => own.get(member.membershipId) ?? 0);
}
