import { weightsToBasisPoints, type CategoryRef, type CategoryView, type CategoryWeightView } from "@hogar/shared";
import type { ExpenseCategory } from "../generated/prisma/client";
import type { CurrentMember } from "../expenses/people";

/** What a category view needs from the database: the row and its weights. */
export type CategoryRow = ExpenseCategory & { weights: { membershipId: string; weight: number }[] };

/** What an expense shows of its category: emoji and name, never its split. */
export function toCategoryRef(category: Pick<ExpenseCategory, "id" | "name" | "emoji"> | null): CategoryRef | null {
  return category ? { id: category.id, name: category.name, emoji: category.emoji } : null;
}

/**
 * A category as the settings show it. Weights follow member order (a member without a row is
 * shown at 0) and are `null` while it follows the household. `needsReview` mirrors the
 * household's `splitNeedsReview` (research R5): members changed since an admin last saved this
 * category's own split, or nobody pays in it.
 */
export function toCategoryView(
  category: CategoryRow,
  members: readonly CurrentMember[],
  household: { membersChangedAt: Date },
  expenseCount: number,
): CategoryView {
  let weights: CategoryWeightView[] | null = null;
  let needsReview = false;
  if (category.ownSplit) {
    const own = new Map(category.weights.map((row) => [row.membershipId, row.weight]));
    const values = members.map((member) => own.get(member.membershipId) ?? 0);
    const anyonePays = values.some((weight) => weight > 0);
    const shares = anyonePays ? weightsToBasisPoints(values) : values.map(() => 0);
    weights = members.map((member, index) => ({
      membershipId: member.membershipId,
      userId: member.userId,
      weight: values[index] ?? 0,
      shareBps: shares[index] ?? 0,
    }));
    const membersChanged = !category.splitSavedAt || category.splitSavedAt < household.membersChangedAt;
    needsReview = members.length >= 2 && (membersChanged || !anyonePays);
  }
  return {
    id: category.id,
    name: category.name,
    emoji: category.emoji,
    position: category.position,
    ownSplit: category.ownSplit,
    weights,
    needsReview,
    expenseCount,
    version: category.version,
  };
}
