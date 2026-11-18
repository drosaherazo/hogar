import { SHOPPING_UNDO_WINDOW_MS, shoppingNameKey, type ShoppingItemView } from "@hogar/shared";
import type { Database } from "../db";
import { assertStillEditor, currentMembers, personRefs, refOf, type Client } from "../expenses/people";
import type { Membership, Prisma, ShoppingItem } from "../generated/prisma/client";
import { isUniqueViolation, lockHousehold } from "../household/householdService";
import { conflict, gone, notFound } from "../httpError";
import { noHouseholdEvents, type HouseholdEvents } from "../realtime/householdEvents";

export interface ShoppingServiceDeps {
  db: Database;
  now?: (() => Date) | undefined;
  /** Where every list and cart change is announced, once it is saved. */
  events?: HouseholdEvents;
}

export interface NewShoppingItem {
  name: string;
  note: string | null;
}

/** Finishing shopping: exactly the items in the caller's cart, and no expense. */
export interface FinishShopping {
  itemIds: readonly string[];
  expense: null;
}

/** What finishing recorded: no expense yet when finishing without one. */
export interface FinishedShopping {
  expense: null;
}

/** Items on the list: neither bought nor deleted. */
const ON_LIST = { boughtAt: null, deletedAt: null } satisfies Prisma.ShoppingItemWhereInput;

/** The list's order: when each item was added, like on paper. */
const LIST_ORDER = [{ addedAt: "asc" }, { id: "asc" }] satisfies Prisma.ShoppingItemOrderByWithRelationInput[];

/** Whether `ids` name exactly the items of `rows`, in any order. */
function sameItems(rows: readonly ShoppingItem[], ids: readonly string[]): boolean {
  const wanted = new Set(ids);
  return rows.length === wanted.size && rows.every((row) => wanted.has(row.id));
}

/** What an edit changes: a missing field stays as it is. */
export interface ShoppingItemChanges {
  name?: string | undefined;
  note?: string | null | undefined;
  version: number;
}

/**
 * The household's shopping list. Everyone in the household reads it; admins and members add to it
 * (the router checks the role). The server decides every conflict (ADR 0009): the database's
 * unique index on the name key is what refuses a duplicate, however close two adds arrive.
 * Every change that is saved is announced to the household as `shopping:changed`.
 */
export function createShoppingService({ db, now = () => new Date(), events = noHouseholdEvents }: ShoppingServiceDeps) {
  /** What everyone sees of `rows`: who asked only while the household shows it (it stays stored either way). */
  async function viewsOf(client: Client, householdId: string, rows: ShoppingItem[]): Promise<ShoppingItemView[]> {
    const { showWhoAsked } = await client.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { showWhoAsked: true },
    });
    const members = await currentMembers(client, householdId);
    const refs = await personRefs(
      client,
      members,
      rows.flatMap((row) => (row.cartOwnerId === null ? [row.askedById] : [row.askedById, row.cartOwnerId])),
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      note: row.note,
      ...(showWhoAsked && { askedBy: refOf(refs, row.askedById) }),
      addedAt: row.addedAt.toISOString(),
      version: row.version,
      cartOwner: row.cartOwnerId === null ? null : refOf(refs, row.cartOwnerId),
    }));
  }

  /**
   * An item of the caller's household, deleted or not, locked until the transaction ends, so
   * changes to the same item take turns and each one sees the last.
   */
  async function lockedItem(tx: Prisma.TransactionClient, householdId: string, id: string) {
    await tx.$queryRaw`SELECT id FROM shopping_items WHERE id = ${id} FOR UPDATE`;
    return tx.shoppingItem.findFirst({ where: { id, householdId } });
  }

  /** The same, for an item on the list: a bought or deleted item is gone for everyone. */
  async function lockedItemOnList(tx: Prisma.TransactionClient, householdId: string, id: string) {
    const row = await lockedItem(tx, householdId, id);
    if (!row || row.boughtAt !== null || row.deletedAt !== null) throw notFound("shopping.item.not_found");
    return row;
  }

  /**
   * What is in the caller's cart, locked until the transaction ends, so an edit or a delete of one
   * of its items (which lock only that item) takes turns with finishing. Items they deleted from
   * their cart stay there for undo, but they aren't in it: they were never bought.
   */
  async function lockedCart(tx: Prisma.TransactionClient, actor: Membership) {
    await tx.$queryRaw`SELECT id FROM shopping_items WHERE household_id = ${actor.householdId} AND cart_owner_id = ${actor.userId} FOR UPDATE`;
    return tx.shoppingItem.findMany({
      where: { householdId: actor.householdId, cartOwnerId: actor.userId, ...ON_LIST },
    });
  }

  /** While an item is in someone's cart, only they can change it, delete it or bring it back. */
  function assertNotInOthersCart(row: ShoppingItem, actor: Membership) {
    if (row.cartOwnerId !== null && row.cartOwnerId !== actor.userId) throw conflict("shopping.item.in_cart");
  }

  async function viewOf(householdId: string, row: ShoppingItem): Promise<ShoppingItemView> {
    const [view] = await viewsOf(db, householdId, [row]);
    if (!view) throw new Error("Every item has a view");
    return view;
  }

  /**
   * The unique index on the name key refuses a second item with the same name on the list. A
   * violation aborts the transaction, so it is caught here, outside it.
   */
  async function refusingDuplicates<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("shopping.item.duplicate");
      throw error;
    }
  }

  /**
   * Moves an item in or out of the caller's cart, as `decide` says: the new owner, or the row
   * unchanged when there is nothing to do. The household lock makes moves take turns with
   * leaving, removals and role changes, so nobody fills a cart that is being emptied, and the role
   * is checked again under it. Moving isn't an edit: the version stays (ADR 0009).
   */
  async function moveInCart(
    actor: Membership,
    id: string,
    decide: (item: ShoppingItem) => { cartOwnerId: string | null } | "unchanged",
  ): Promise<ShoppingItemView> {
    const { row, moved } = await db.$transaction(async (tx) => {
      await lockHousehold(tx, actor.householdId);
      assertStillEditor(await currentMembers(tx, actor.householdId), actor);
      const current = await lockedItemOnList(tx, actor.householdId, id);
      const decision = decide(current);
      if (decision === "unchanged") return { row: current, moved: false };
      return { row: await tx.shoppingItem.update({ where: { id }, data: decision }), moved: true };
    });
    if (moved) events.publish(actor.householdId, "shopping:changed");
    return viewOf(actor.householdId, row);
  }

  return {
    /** The items on the list in the order they were added, like a paper list. */
    async list(householdId: string): Promise<ShoppingItemView[]> {
      const rows = await db.shoppingItem.findMany({ where: { householdId, ...ON_LIST }, orderBy: LIST_ORDER });
      return viewsOf(db, householdId, rows);
    },

    /** A new item goes last, asked for by whoever adds it. */
    async add(actor: Membership, input: NewShoppingItem): Promise<ShoppingItemView> {
      const row = await refusingDuplicates(() =>
        db.shoppingItem.create({
          data: {
            householdId: actor.householdId,
            name: input.name,
            nameKey: shoppingNameKey(input.name),
            note: input.note,
            askedById: actor.userId,
            addedAt: now(),
          },
        }),
      );
      events.publish(actor.householdId, "shopping:changed");
      return viewOf(actor.householdId, row);
    },

    /**
     * Renames the item or changes its note. The edit names the version it started from, and one
     * based on an older version is refused, so nobody overwrites a change they haven't seen
     * (ADR 0009). Saving what is already there changes nothing, not even the version. While the
     * item is in someone's cart, only they can edit it.
     */
    async edit(actor: Membership, id: string, changes: ShoppingItemChanges): Promise<ShoppingItemView> {
      const { row, changed } = await refusingDuplicates(() =>
        db.$transaction(async (tx) => {
          const current = await lockedItemOnList(tx, actor.householdId, id);
          assertNotInOthersCart(current, actor);
          if (current.version !== changes.version) throw conflict("shopping.item.changed");
          const name = changes.name ?? current.name;
          const note = changes.note === undefined ? current.note : changes.note;
          if (name === current.name && note === current.note) return { row: current, changed: false };
          const edited = await tx.shoppingItem.update({
            where: { id },
            data: { name, nameKey: shoppingNameKey(name), note, version: { increment: 1 } },
          });
          return { row: edited, changed: true };
        }),
      );
      if (changed) events.publish(actor.householdId, "shopping:changed");
      return viewOf(actor.householdId, row);
    },

    /**
     * Takes the item off the list at once; whoever deleted it can undo for a while. An item in
     * someone's cart stays there, so undoing brings it back as it was; only they can delete it.
     */
    async remove(actor: Membership, id: string, version: number): Promise<void> {
      await db.$transaction(async (tx) => {
        const row = await lockedItemOnList(tx, actor.householdId, id);
        assertNotInOthersCart(row, actor);
        if (row.version !== version) throw conflict("shopping.item.changed");
        await tx.shoppingItem.update({ where: { id }, data: { deletedAt: now(), deletedById: actor.userId } });
      });
      events.publish(actor.householdId, "shopping:changed");
    },

    /**
     * Undoes the caller's own delete within the window: the item comes back in its place, as it
     * was. For anyone else a deleted item leaves no trace, so they get `not_found`, as everyone
     * does for a bought item. A second tap finds the item already back and changes nothing.
     */
    async restore(actor: Membership, id: string): Promise<ShoppingItemView> {
      const { row, restored } = await refusingDuplicates(() =>
        db.$transaction(async (tx) => {
          const current = await lockedItem(tx, actor.householdId, id);
          if (current && current.deletedAt === null && current.boughtAt === null) {
            return { row: current, restored: false };
          }
          if (!current?.deletedAt || current.deletedById !== actor.userId) throw notFound("shopping.item.not_found");
          assertNotInOthersCart(current, actor);
          if (now().getTime() - current.deletedAt.getTime() > SHOPPING_UNDO_WINDOW_MS) {
            throw gone("shopping.undo.expired");
          }
          const back = await tx.shoppingItem.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
          return { row: back, restored: true };
        }),
      );
      if (restored) events.publish(actor.householdId, "shopping:changed");
      return viewOf(actor.householdId, row);
    },

    /**
     * Puts the item in the caller's cart. Two people tapping the same item take turns, so the first
     * one wins and the other is told it is in someone else's cart. A second tap changes nothing.
     */
    putInCart(actor: Membership, id: string): Promise<ShoppingItemView> {
      return moveInCart(actor, id, (item) => {
        if (item.cartOwnerId === actor.userId) return "unchanged";
        if (item.cartOwnerId !== null) throw conflict("shopping.item.in_cart");
        return { cartOwnerId: actor.userId };
      });
    },

    /**
     * Takes the item out of the caller's cart: back on the list, still to buy. Only the cart's owner
     * can; an item in nobody's cart stays as it is.
     */
    takeOutOfCart(actor: Membership, id: string): Promise<ShoppingItemView> {
      return moveInCart(actor, id, (item) => {
        if (item.cartOwnerId === null) return "unchanged";
        if (item.cartOwnerId !== actor.userId) throw conflict("shopping.item.in_cart");
        return { cartOwnerId: null };
      });
    },

    /**
     * Finishes the caller's shopping: everything in their cart leaves the list at once, as bought
     * items, and what they didn't find stays on it. `itemIds` must be exactly their cart, as they
     * last saw it; a cart that changed meanwhile (on their other device) is refused whole with
     * `shopping.cart.changed`, so nothing is ever half bought. Like a cart move, it takes turns with
     * leaving, removals and role changes under the household lock, and checks the role again there.
     */
    async finish(actor: Membership, { itemIds }: FinishShopping): Promise<FinishedShopping> {
      await db.$transaction(async (tx) => {
        await lockHousehold(tx, actor.householdId);
        assertStillEditor(await currentMembers(tx, actor.householdId), actor);
        if (!sameItems(await lockedCart(tx, actor), itemIds)) throw conflict("shopping.cart.changed");
        await tx.shoppingItem.updateMany({
          where: { id: { in: [...itemIds] } },
          data: { boughtAt: now(), boughtById: actor.userId, cartOwnerId: null },
        });
      });
      events.publish(actor.householdId, "shopping:changed");
      return { expense: null };
    },

    /**
     * Undoes the caller's finish within the window: the items come back into their cart, each in
     * its place on the list. Only for items they bought, and all of them or none: for anything
     * else it is too late. A name added again meanwhile meets the unique index and refuses the
     * whole undo with `shopping.item.duplicate`. A second tap finds the items already back in their
     * cart and changes nothing.
     */
    async undoFinish(actor: Membership, itemIds: readonly string[]): Promise<ShoppingItemView[]> {
      const { rows, undone } = await refusingDuplicates(() =>
        db.$transaction(async (tx) => {
          await lockHousehold(tx, actor.householdId);
          assertStillEditor(await currentMembers(tx, actor.householdId), actor);
          const ids = [...itemIds];
          await tx.$queryRaw`SELECT id FROM shopping_items WHERE household_id = ${actor.householdId} AND id = ANY(${ids}) FOR UPDATE`;
          const items = await tx.shoppingItem.findMany({
            where: { householdId: actor.householdId, id: { in: ids } },
            orderBy: LIST_ORDER,
          });
          const back = (row: ShoppingItem) =>
            row.boughtAt === null && row.deletedAt === null && row.cartOwnerId === actor.userId;
          const undoable = (row: ShoppingItem) =>
            row.boughtById === actor.userId &&
            row.boughtAt !== null &&
            now().getTime() - row.boughtAt.getTime() <= SHOPPING_UNDO_WINDOW_MS;
          if (!sameItems(items, ids) || !items.every((row) => back(row) || undoable(row))) {
            throw gone("shopping.undo.expired");
          }
          const bought = items.filter(undoable).map((row) => row.id);
          if (bought.length === 0) return { rows: items, undone: false };
          await tx.shoppingItem.updateMany({
            where: { id: { in: bought } },
            data: { boughtAt: null, boughtById: null, cartOwnerId: actor.userId },
          });
          return {
            rows: await tx.shoppingItem.findMany({ where: { id: { in: ids } }, orderBy: LIST_ORDER }),
            undone: true,
          };
        }),
      );
      if (undone) events.publish(actor.householdId, "shopping:changed");
      return viewsOf(db, actor.householdId, rows);
    },
  };
}

export type ShoppingService = ReturnType<typeof createShoppingService>;
