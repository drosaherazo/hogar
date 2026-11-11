import { splitAmount, type ExpenseInput, type ExpenseView, type SplitMethod } from "@hogar/shared";
import type { Database } from "../db";
import type { Membership, Prisma } from "../generated/prisma/client";
import { lockHousehold } from "../household/householdService";
import { badRequest, notFound } from "../httpError";
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

const EXPENSE_INCLUDE = { shares: true } satisfies Prisma.ExpenseInclude;
type ExpenseRow = Prisma.ExpenseGetPayload<{ include: typeof EXPENSE_INCLUDE }>;

interface ComputedSplit {
  method: SplitMethod;
  shares: { userId: string; amountCents: number }[];
}

export interface ExpenseServiceDeps {
  db: Database;
  now?: (() => Date) | undefined;
}

/**
 * Shares for a new split, in member order. Every person must be a current member: former
 * members stay in the history but can't be added to new expenses.
 */
function computeSplit(input: ExpenseInput, members: readonly CurrentMember[]): ComputedSplit {
  const memberIds = new Set(members.map((member) => member.userId));
  const assertMembers = (userIds: readonly string[]) => {
    if (userIds.some((userId) => !memberIds.has(userId))) throw badRequest("expense.person.not_member");
  };
  assertMembers([input.paidById]);

  switch (input.split.method) {
    case "WEIGHTS": {
      // The household's split, frozen now: later weight changes never touch this expense.
      const sharing = members.filter((member) => member.weight > 0);
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
      assertMembers(input.split.userIds);
      const chosen = new Set(input.split.userIds);
      const sharing = members.filter((member) => chosen.has(member.userId));
      const amounts = splitAmount(
        input.amountCents,
        sharing.map(() => 1),
      );
      return {
        method: "EQUAL",
        shares: sharing.map((member, index) => ({ userId: member.userId, amountCents: amounts[index] ?? 0 })),
      };
    }
    case "EXACT": {
      // As entered (the schema checked they add up); someone given €0.00 doesn't share it.
      const { shares } = input.split;
      assertMembers(shares.map((share) => share.userId));
      return {
        method: "EXACT",
        shares: members.flatMap((member) => {
          const share = shares.find((entry) => entry.userId === member.userId);
          return share && share.amountCents > 0 ? [{ userId: member.userId, amountCents: share.amountCents }] : [];
        }),
      };
    }
  }
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
      createdBy: refOf(refs, row.createdById),
      createdAt: row.createdAt.toISOString(),
      editedBy: row.editedById ? refOf(refs, row.editedById) : null,
      editedAt: row.editedAt?.toISOString() ?? null,
      version: row.version,
    };
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
    async create(actor: Membership, input: ExpenseInput): Promise<ExpenseView> {
      assertNotFuture(input.date, now());
      return db.$transaction(async (tx) => {
        await lockHousehold(tx, actor.householdId);
        const members = await currentMembers(tx, actor.householdId);
        assertStillEditor(members, actor);
        const split = computeSplit(input, members);
        const row = await tx.expense.create({
          data: {
            householdId: actor.householdId,
            description: input.description,
            amountCents: input.amountCents,
            date: fromCalendarDate(input.date),
            paidById: input.paidById,
            splitMethod: split.method,
            createdById: actor.userId,
            createdAt: now(),
            shares: { create: split.shares },
          },
          include: EXPENSE_INCLUDE,
        });
        return toView(tx, row, members);
      });
    },
  };
}

export type ExpenseService = ReturnType<typeof createExpenseService>;
