import { canEditContent, splitAmount, type ExpenseInput, type ExpenseView, type SplitMethod } from "@hogar/shared";
import type { Database } from "../db";
import type { Membership, Prisma } from "../generated/prisma/client";
import { lockHousehold } from "../household/householdService";
import { badRequest, forbidden, notFound } from "../httpError";
import { assertNotFuture, fromCalendarDate, toCalendarDate } from "./dates";
import { currentMembers, orderPeople, personRefs, refOf, type Client, type CurrentMember } from "./people";

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
 * The actor's role may have changed since the request's own check (an admin can demote people
 * at any time), so it is checked again against the members read under the household lock.
 */
function assertStillEditor(members: readonly CurrentMember[], actor: Membership) {
  const current = members.find((member) => member.userId === actor.userId);
  if (!current || !canEditContent(current.role)) throw forbidden("household.read_only");
}

/**
 * Shares for a new split, in member order. Every person must be a current member: former
 * members stay in the history but can't be added to new expenses.
 */
function computeSplit(input: ExpenseInput, members: readonly CurrentMember[]): ComputedSplit {
  if (!members.some((member) => member.userId === input.paidById)) throw badRequest("expense.person.not_member");

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
    default:
      // "Equally" and "exact amounts" arrive with their own story (US4).
      throw badRequest("expense.split.invalid");
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
