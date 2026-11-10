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
