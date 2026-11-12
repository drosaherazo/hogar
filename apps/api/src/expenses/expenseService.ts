import {
  defaultWeights,
  splitAmount,
  type CategorySplit,
  type ExpenseView,
  type ParsedExpenseInput,
  type ParsedUpdateExpenseInput,
  type SplitMethod,
} from "@hogar/shared";
import { toCategoryRef } from "../categories/categoryView";
import type { Database } from "../db";
import type { Membership, Prisma } from "../generated/prisma/client";
import { lockHousehold } from "../household/householdService";
import { badRequest, conflict, notFound } from "../httpError";
import { assertNotFuture, fromCalendarDate, toCalendarDate } from "./dates";
import {
  assertStillEditor,
  currentMembers,
  orderPeople,
  personRefs,
  refOf,
  type Client,
  type CurrentMember,
} from "./people";

const EXPENSE_INCLUDE = {
  shares: true,
  category: { select: { id: true, name: true, emoji: true } },
} satisfies Prisma.ExpenseInclude;
type ExpenseRow = Prisma.ExpenseGetPayload<{ include: typeof EXPENSE_INCLUDE }>;

interface ComputedSplit {
  method: SplitMethod;
  shares: { userId: string; amountCents: number }[];
}

/**
 * Who may appear in a split, and in which order leftover cents are handed out. A new expense
 * allows current members only; an edited one also keeps the people already in it, so former
 * members stay in their expenses (but are never added to new ones).
 */
interface SplitContext {
  members: readonly CurrentMember[];
  allowed: ReadonlySet<string>;
  /** Current members in member order, then any former member already in the expense. */
  order: readonly string[];
}

function contextFor(members: readonly CurrentMember[], existing?: ExpenseRow): SplitContext {
  const memberIds = members.map((member) => member.userId);
  const formerInExpense = existing
    ? [...new Set([existing.paidById, ...existing.shares.map((share) => share.userId)])]
        .filter((userId) => !memberIds.includes(userId))
        .sort()
    : [];
  const order = [...memberIds, ...formerInExpense];
  return { members, allowed: new Set(order), order };
}

/** Shares for a split chosen by the person, following the context's order. */
function computeSplit(
  input: ParsedExpenseInput,
  { members, allowed, order }: SplitContext,
  category: CategorySplit | null,
): ComputedSplit {
  const assertAllowed = (userIds: readonly string[]) => {
    if (userIds.some((userId) => !allowed.has(userId))) throw badRequest("expense.person.not_member");
  };
  assertAllowed([input.paidById]);

  switch (input.split.method) {
    case "WEIGHTS": {
      // The default split (the category's own weights, or the household's), frozen now: later
      // weight changes never touch this expense.
      const weights = defaultWeights(members, category);
      const sharing = members
        .map((member, index) => ({ userId: member.userId, weight: weights[index] ?? 0 }))
        .filter((member) => member.weight > 0);
      if (sharing.length === 0) throw badRequest("expense.split.no_default");
      const amounts = splitAmount(
        input.amountCents,
        sharing.map((member) => member.weight),
      );
      return {
        method: "WEIGHTS",
        shares: sharing.map((member, index) => ({ userId: member.userId, amountCents: amounts[index] ?? 0 })),
      };
    }
    case "EQUAL": {
      // Everyone chosen is kept, even at €0.00 (€0.02 among three); leftovers follow member order.
      assertAllowed(input.split.userIds);
      const chosen = new Set(input.split.userIds);
      const sharing = order.filter((userId) => chosen.has(userId));
      const amounts = splitAmount(
        input.amountCents,
        sharing.map(() => 1),
      );
      return {
        method: "EQUAL",
        shares: sharing.map((userId, index) => ({ userId, amountCents: amounts[index] ?? 0 })),
      };
    }
    case "EXACT": {
      // As entered (the schema checked they add up); someone given €0.00 doesn't share it.
      const { shares } = input.split;
      assertAllowed(shares.map((share) => share.userId));
      return {
        method: "EXACT",
        shares: order.flatMap((userId) => {
          const share = shares.find((entry) => entry.userId === userId);
          return share && share.amountCents > 0 ? [{ userId, amountCents: share.amountCents }] : [];
        }),
      };
    }
  }
}

/**
 * Fresh default shares are saved only if they are exactly the ones the person was shown
 * (research R3): otherwise the weights, the category or the members changed in between, and
 * the form must show the new figures first.
 */
function assertPreview(computed: ComputedSplit, input: ParsedExpenseInput): void {
  if (computed.method !== "WEIGHTS" || input.split.method !== "WEIGHTS") return;
  const preview = input.split.previewShares;
  if (!preview) throw badRequest("request.invalid");
  const shown = new Map(preview.map((share) => [share.userId, share.amountCents]));
  const same =
    shown.size === computed.shares.length &&
    computed.shares.every((share) => shown.get(share.userId) === share.amountCents);
  if (!same) throw conflict("expense.split.changed");
}

/**
 * The split of an edited expense. An expense saved with the default split keeps the agreement
 * it was saved with: same amount, same shares; new amount, same proportions among the same
 * people (002 research R3), whatever its category now. Only when the edit carries the previewed
 * shares ("apply the new category's split") are fresh shares computed, and they must match.
 * Switching from another method to the default split always computes fresh shares, checked the
 * same way. Shares only change because someone edited this expense and saw them.
 */
function computeEditedSplit(
  input: ParsedExpenseInput,
  existing: ExpenseRow,
  context: SplitContext,
  category: CategorySplit | null,
): ComputedSplit {
  const keepsSaved =
    existing.splitMethod === "WEIGHTS" && input.split.method === "WEIGHTS" && !input.split.previewShares;
  if (!keepsSaved) {
    const split = computeSplit(input, context, category);
    assertPreview(split, input);
    return split;
  }
  if (!context.allowed.has(input.paidById)) throw badRequest("expense.person.not_member");

  const position = (userId: string) => context.order.indexOf(userId);
  const saved = [...existing.shares].sort((a, b) => position(a.userId) - position(b.userId));
  const amounts =
    input.amountCents === existing.amountCents
      ? saved.map((share) => share.amountCents)
      : splitAmount(
          input.amountCents,
          saved.map((share) => share.amountCents),
        );
  return {
    method: "WEIGHTS",
    shares: saved.map((share, index) => ({ userId: share.userId, amountCents: amounts[index] ?? 0 })),
  };
}

export interface ExpenseServiceDeps {
  db: Database;
  now?: (() => Date) | undefined;
}

export function createExpenseService({ db, now = () => new Date() }: ExpenseServiceDeps) {
  /** What the web sees of an expense: people as references, shares in member order. */
  async function toView(client: Client, row: ExpenseRow, members?: readonly CurrentMember[]): Promise<ExpenseView> {
    const current = members ?? (await currentMembers(client, row.householdId));
    const refs = await personRefs(client, current, [
      row.paidById,
      row.createdById,
      ...(row.editedById ? [row.editedById] : []),
      ...row.shares.map((share) => share.userId),
    ]);
    const shares = orderPeople(
      row.shares.map((share) => ({ person: refOf(refs, share.userId), amountCents: share.amountCents })),
      (share) => share.person,
      current,
    );
    return {
      id: row.id,
      description: row.description,
      amountCents: row.amountCents,
      date: toCalendarDate(row.date),
      paidBy: refOf(refs, row.paidById),
      split: { method: row.splitMethod, shares },
      category: toCategoryRef(row.category),
      createdBy: refOf(refs, row.createdById),
      createdAt: row.createdAt.toISOString(),
      editedBy: row.editedById ? refOf(refs, row.editedById) : null,
      editedAt: row.editedAt?.toISOString() ?? null,
      version: row.version,
    };
  }

  /**
   * The expense's category with what its default split needs. It must belong to the caller's
   * household; a category deleted while the form was open gets the same answer.
   */
  async function categoryOf(tx: Client, householdId: string, categoryId: string | null) {
    if (categoryId === null) return null;
    const category = await tx.expenseCategory.findFirst({
      where: { id: categoryId, householdId },
      select: { id: true, ownSplit: true, weights: { select: { membershipId: true, weight: true } } },
    });
    if (!category) throw badRequest("expense.category.not_found");
    return category;
  }

  /** A live expense of the household, at the version the caller saw. */
  async function current(tx: Client, householdId: string, expenseId: string, version: number): Promise<ExpenseRow> {
    const row = await tx.expense.findFirst({
      where: { id: expenseId, householdId, deletedAt: null },
      include: EXPENSE_INCLUDE,
    });
    if (!row) throw notFound("expense.not_found");
    if (row.version !== version) throw conflict("expense.changed");
    return row;
  }

  return {
    /** A live expense of the caller's household; anything else is "not found". */
    async get(householdId: string, expenseId: string): Promise<ExpenseView> {
      const row = await db.expense.findFirst({
        where: { id: expenseId, householdId, deletedAt: null },
        include: EXPENSE_INCLUDE,
      });
      if (!row) throw notFound("expense.not_found");
      return toView(db, row);
    },

    /**
     * Records an expense and its shares together. It runs under the household lock, so the
     * members it checks (and whose weights it reads) can't change until it commits.
     */
    async create(actor: Membership, input: ParsedExpenseInput): Promise<ExpenseView> {
      assertNotFuture(input.date, now());
      return db.$transaction(async (tx) => {
        await lockHousehold(tx, actor.householdId);
        const members = await currentMembers(tx, actor.householdId);
        assertStillEditor(members, actor);
        const category = await categoryOf(tx, actor.householdId, input.categoryId);
        const split = computeSplit(input, contextFor(members), category);
        assertPreview(split, input);
        const row = await tx.expense.create({
          data: {
            householdId: actor.householdId,
            description: input.description,
            amountCents: input.amountCents,
            date: fromCalendarDate(input.date),
            paidById: input.paidById,
            splitMethod: split.method,
            categoryId: category?.id ?? null,
            createdById: actor.userId,
            createdAt: now(),
            shares: { create: split.shares },
          },
          include: EXPENSE_INCLUDE,
        });
        return toView(tx, row, members);
      });
    },

    /**
     * Any editor may change any expense, but only from the version they saw: a change based on
     * an outdated version is refused, so nobody overwrites what they haven't seen. The shares
     * are replaced in the same transaction that bumps the version.
     */
    async update(actor: Membership, expenseId: string, input: ParsedUpdateExpenseInput): Promise<ExpenseView> {
      assertNotFuture(input.date, now());
      return db.$transaction(async (tx) => {
        await lockHousehold(tx, actor.householdId);
        const members = await currentMembers(tx, actor.householdId);
        assertStillEditor(members, actor);
        const existing = await current(tx, actor.householdId, expenseId, input.version);
        const category = await categoryOf(tx, actor.householdId, input.categoryId);
        const split = computeEditedSplit(input, existing, contextFor(members, existing), category);

        await tx.expenseShare.deleteMany({ where: { expenseId } });
        const row = await tx.expense.update({
          where: { id: expenseId },
          data: {
            description: input.description,
            amountCents: input.amountCents,
            date: fromCalendarDate(input.date),
            paidById: input.paidById,
            splitMethod: split.method,
            categoryId: category?.id ?? null,
            editedById: actor.userId,
            editedAt: now(),
            version: { increment: 1 },
            shares: { create: split.shares },
          },
          include: EXPENSE_INCLUDE,
        });
        return toView(tx, row, members);
      });
    },

    /**
     * Deleting keeps the row and its shares, marked with who deleted it and when: it stops
     * counting everywhere, and the history keeps a line saying what happened (research R17).
     */
    async remove(actor: Membership, expenseId: string, version: number): Promise<void> {
      await db.$transaction(async (tx) => {
        await lockHousehold(tx, actor.householdId);
        assertStillEditor(await currentMembers(tx, actor.householdId), actor);
        await current(tx, actor.householdId, expenseId, version);
        await tx.expense.update({ where: { id: expenseId }, data: { deletedAt: now(), deletedById: actor.userId } });
      });
    },
  };
}

export type ExpenseService = ReturnType<typeof createExpenseService>;
