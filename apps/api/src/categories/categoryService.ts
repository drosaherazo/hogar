import { MAX_CATEGORIES, type CategoryView, type UpdateCategorySplitInput } from "@hogar/shared";
import type { Database } from "../db";
import type { Membership, Prisma } from "../generated/prisma/client";
import { currentMembers, type Client, type CurrentMember } from "../expenses/people";
import { isUniqueViolation, lockHousehold } from "../household/householdService";
import { badRequest, conflict, notFound } from "../httpError";
import { toCategoryView, type CategoryRow } from "./categoryView";

const CATEGORY_INCLUDE = {
  weights: { select: { membershipId: true, weight: true } },
} satisfies Prisma.ExpenseCategoryInclude;

export interface CategoryServiceDeps {
  db: Database;
  now?: (() => Date) | undefined;
}

export interface CategoryNameInput {
  name: string;
  emoji: string | null;
}

/**
 * The household's expense categories. Everyone in the household reads them; only admins change
 * them (the router checks the role). Every write runs under the household lock, so the name
 * check, the limit and the position can't race, and changes must name the version they saw.
 * Nothing here ever touches an expense's shares (FR-008, FR-009, FR-020).
 */
export function createCategoryService({ db, now = () => new Date() }: CategoryServiceDeps) {
  /** Live expenses per category, for the delete confirmation. */
  async function expenseCounts(client: Client, householdId: string, categoryIds?: string[]) {
    const rows = await client.expense.groupBy({
      by: ["categoryId"],
      where: {
        householdId,
        deletedAt: null,
        categoryId: categoryIds ? { in: categoryIds } : { not: null },
      },
      _count: { _all: true },
    });
    return new Map(rows.map((row) => [row.categoryId, row._count._all]));
  }

  async function viewOf(client: Client, householdId: string, row: CategoryRow, members?: CurrentMember[]) {
    const [household, counts, people] = await Promise.all([
      client.household.findUniqueOrThrow({ where: { id: householdId }, select: { membersChangedAt: true } }),
      expenseCounts(client, householdId, [row.id]),
      members ?? currentMembers(client, householdId),
    ]);
    return toCategoryView(row, people, household, counts.get(row.id) ?? 0);
  }

  /** A category of the caller's household, at the version they saw. */
  async function current(tx: Client, householdId: string, id: string, version: number): Promise<CategoryRow> {
    const row = await tx.expenseCategory.findFirst({ where: { id, householdId }, include: CATEGORY_INCLUDE });
    if (!row) throw notFound("category.not_found");
    if (row.version !== version) throw conflict("category.changed");
    return row;
  }

  /** Names are unique per household ignoring case and surrounding spaces (the schema trims). */
  async function assertNameFree(tx: Client, householdId: string, name: string, exceptId?: string) {
    // `lower(name) = lower(…)`, like the unique index; Prisma's case-insensitive `equals` uses
    // ILIKE, where `_` and `%` in a name would match other names.
    const taken = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM expense_categories
      WHERE household_id = ${householdId} AND lower(name) = lower(${name}) AND id <> ${exceptId ?? ""}
      LIMIT 1`;
    if (taken.length > 0) throw badRequest("category.name.taken");
  }

  /** The database's unique index backs the check above; its violation means the same thing. */
  async function withNameGuard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (isUniqueViolation(error)) throw badRequest("category.name.taken");
      throw error;
    }
  }

  return {
    /** Every category of the household in list order, with its split and how many expenses use it. */
    async list(householdId: string): Promise<CategoryView[]> {
      const [rows, counts, members, household] = await Promise.all([
        db.expenseCategory.findMany({
          where: { householdId },
          orderBy: { position: "asc" },
          include: CATEGORY_INCLUDE,
        }),
        expenseCounts(db, householdId),
        currentMembers(db, householdId),
        db.household.findUniqueOrThrow({ where: { id: householdId }, select: { membersChangedAt: true } }),
      ]);
      return rows.map((row) => toCategoryView(row, members, household, counts.get(row.id) ?? 0));
    },

    /** A new category goes last and follows the household's split. */
    async create(actor: Membership, input: CategoryNameInput): Promise<CategoryView> {
      return withNameGuard(() =>
        db.$transaction(async (tx) => {
          await lockHousehold(tx, actor.householdId);
          const existing = await tx.expenseCategory.aggregate({
            where: { householdId: actor.householdId },
            _count: { _all: true },
            _max: { position: true },
          });
          if (existing._count._all >= MAX_CATEGORIES) throw badRequest("category.limit_reached");
          await assertNameFree(tx, actor.householdId, input.name);
          const row = await tx.expenseCategory.create({
            data: {
              householdId: actor.householdId,
              name: input.name,
              emoji: input.emoji,
              position: (existing._max.position ?? 0) + 1,
              createdAt: now(),
            },
            include: CATEGORY_INCLUDE,
          });
          return viewOf(tx, actor.householdId, row);
        }),
      );
    },

    /** Renaming or changing the emoji shows on every expense in it; no share changes. */
    async rename(actor: Membership, id: string, input: CategoryNameInput & { version: number }): Promise<CategoryView> {
      return withNameGuard(() =>
        db.$transaction(async (tx) => {
          await lockHousehold(tx, actor.householdId);
          await current(tx, actor.householdId, id, input.version);
          await assertNameFree(tx, actor.householdId, input.name, id);
          const row = await tx.expenseCategory.update({
            where: { id },
            data: { name: input.name, emoji: input.emoji, version: { increment: 1 } },
            include: CATEGORY_INCLUDE,
          });
          return viewOf(tx, actor.householdId, row);
        }),
      );
    },

    /**
     * Ticking the box saves one weight per current member (the list must match the memberships
     * exactly); unticking discards them. Either way, saved expenses keep their shares.
     */
    async updateSplit(actor: Membership, id: string, input: UpdateCategorySplitInput): Promise<CategoryView> {
      return db.$transaction(async (tx) => {
        await lockHousehold(tx, actor.householdId);
        await current(tx, actor.householdId, id, input.version);
        const members = await currentMembers(tx, actor.householdId);
        await tx.categoryWeight.deleteMany({ where: { categoryId: id } });
        if (input.ownSplit) {
          const sent = new Map(input.weights.map((entry) => [entry.membershipId, entry.weight]));
          const matches = sent.size === members.length && members.every((member) => sent.has(member.membershipId));
          if (!matches) throw conflict("split.members_changed");
          await tx.categoryWeight.createMany({
            data: members.map((member) => ({
              categoryId: id,
              membershipId: member.membershipId,
              weight: sent.get(member.membershipId) ?? 0,
            })),
          });
        }
        const row = await tx.expenseCategory.update({
          where: { id },
          data: {
            ownSplit: input.ownSplit,
            splitSavedAt: input.ownSplit ? now() : null,
            version: { increment: 1 },
          },
          include: CATEGORY_INCLUDE,
        });
        return viewOf(tx, actor.householdId, row, members);
      });
    },

    /**
     * Deleting removes the category and its weights. Its expenses, live and deleted, are left
     * without a category by the foreign key; their shares are untouched.
     */
    async remove(actor: Membership, id: string, version: number): Promise<void> {
      await db.$transaction(async (tx) => {
        await lockHousehold(tx, actor.householdId);
        await current(tx, actor.householdId, id, version);
        await tx.expenseCategory.delete({ where: { id } });
      });
    },
  };
}

export type CategoryService = ReturnType<typeof createCategoryService>;
