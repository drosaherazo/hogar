import {
  expenseResponseSchema,
  finishShoppingResponseSchema,
  shoppingItemResponseSchema,
  shoppingItemsResponseSchema,
  shoppingListSchema,
  type ExpenseInput,
} from "@hogar/shared";
import { describe, expect, it } from "vitest";
import { addCategory, deleteCategory } from "./categoryHelpers";
import {
  addExpense,
  balanceByUser,
  balancesOf,
  deleteExpense,
  homeWithGuest,
  inputOf,
  previewSharesFor,
  putExpense,
  sharesByUser,
  TODAY,
} from "./expenseHelpers";
import { createHousehold } from "./householdHelpers";
import { request } from "./request";
import {
  addItem,
  deleteItem,
  getList,
  listOf,
  patchItem,
  postItem,
  putInCart,
  refOf,
  restoreItem,
  takeOutOfCart,
  type App,
} from "./shoppingHelpers";
import { createTestApp, dani, signIn, type SignedIn } from "./testApp";

const finish = (app: App, who: SignedIn, body: object) =>
  request(app).post("/api/household/shopping/finish").set("Authorization", who.auth).send(body);

const changeRole = (app: App, admin: SignedIn, membershipId: string, role: string) =>
  request(app).patch(`/api/household/members/${membershipId}`).set("Authorization", admin.auth).send({ role });

interface Ids {
  milk: string;
  eggs: string;
  bread: string;
  rice: string;
}

/** Milk and Eggs in Bruno's cart, Bread in Ana's, and Rice in nobody's. */
async function shopping(app: App) {
  const home = await homeWithGuest(app);
  const { ana, bruno } = home;
  const milk = await addItem(app, ana, "Milk");
  const eggs = await addItem(app, ana, "Eggs");
  const bread = await addItem(app, bruno, "Bread");
  const rice = await addItem(app, ana, "Rice");
  await putInCart(app, bruno, milk.id).expect(200);
  await putInCart(app, bruno, eggs.id).expect(200);
  const breadInCart = shoppingItemResponseSchema.parse((await putInCart(app, ana, bread.id).expect(200)).body).item;
  return { ...home, milk, eggs, bread: breadInCart, rice };
}

describe("POST /api/household/shopping/finish", () => {
  it("takes what is in the caller's cart off everyone's list, and leaves the rest as it was", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla, milk, eggs, bread, rice } = await shopping(app);

    const res = await finish(app, bruno, { itemIds: [eggs.id, milk.id], expense: null });

    expect(res.status).toBe(200);
    expect(finishShoppingResponseSchema.parse(res.body)).toEqual({ expense: null });
    for (const who of [ana, bruno, carla]) expect(await listOf(app, who)).toEqual([bread, rice]);
  });
});

describe("finishing: the cart must be what the person saw", () => {
  it.each([
    ["leaves out an item in the cart", (ids: Ids) => [ids.milk]],
    ["names an item that isn't in it", (ids: Ids) => [ids.milk, ids.eggs, ids.rice]],
    ["names an item in someone else's cart", (ids: Ids) => [ids.milk, ids.eggs, ids.bread]],
    ["names an item that doesn't exist", (ids: Ids) => [ids.milk, ids.eggs, "item_missing"]],
  ])("refuses a finish that %s, and buys nothing", async (_case, itemIds) => {
    const { app } = createTestApp();
    const { ana, bruno, milk, eggs, bread, rice } = await shopping(app);
    const before = await listOf(app, ana);

    const res = await finish(app, bruno, {
      itemIds: itemIds({ milk: milk.id, eggs: eggs.id, bread: bread.id, rice: rice.id }),
      expense: null,
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "shopping.cart.changed" } });
    expect(await listOf(app, ana)).toEqual(before);
  });

  it("refuses a finish once the cart is empty, as after finishing on another device", async () => {
    const { app } = createTestApp();
    const { bruno, milk, eggs } = await shopping(app);
    await finish(app, bruno, { itemIds: [milk.id, eggs.id], expense: null }).expect(200);

    const again = await finish(app, bruno, { itemIds: [milk.id, eggs.id], expense: null });

    expect(again.status).toBe(409);
    expect(again.body).toEqual({ error: { code: "shopping.cart.changed" } });
  });

  it("never buys an item deleted from the cart: it isn't in the cart, and undoing the delete brings it back there", async () => {
    const { app } = createTestApp();
    const { ana, bruno, milk, eggs, bread, rice } = await shopping(app);
    await deleteItem(app, bruno, milk).expect(204);

    const withDeleted = await finish(app, bruno, { itemIds: [milk.id, eggs.id], expense: null });
    expect(withDeleted.status).toBe(409);
    expect(withDeleted.body).toEqual({ error: { code: "shopping.cart.changed" } });

    await finish(app, bruno, { itemIds: [eggs.id], expense: null }).expect(200);
    await restoreItem(app, bruno, milk.id).expect(200);
    expect(await listOf(app, ana)).toEqual([{ ...milk, cartOwner: refOf(bruno, "Bruno Díaz") }, bread, rice]);
  });
});

describe("finishing: what to send", () => {
  it.each([
    ["no expense field", (id: string) => ({ itemIds: [id] })],
    ["no items", () => ({ itemIds: [], expense: null })],
    ["the same item twice", (id: string) => ({ itemIds: [id, id], expense: null })],
    ["items that aren't ids", () => ({ itemIds: [7], expense: null })],
  ])("answers request.invalid to %s, and buys nothing", async (_case, body) => {
    const { app } = createTestApp();
    const { ana, bruno, milk } = await shopping(app);
    const before = await listOf(app, ana);

    const res = await finish(app, bruno, body(milk.id));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "request.invalid" } });
    expect(await listOf(app, ana)).toEqual(before);
  });
});

describe("finishing: who can", () => {
  it("lets an admin finish their own cart", async () => {
    const { app } = createTestApp();
    const { ana, bread } = await shopping(app);
    await finish(app, ana, { itemIds: [bread.id], expense: null }).expect(200);
    expect((await listOf(app, ana)).map((item) => item.name)).toEqual(["Milk", "Eggs", "Rice"]);
  });

  it("refuses guests", async () => {
    const { app } = createTestApp();
    const { carla, rice } = await shopping(app);
    const res = await finish(app, carla, { itemIds: [rice.id], expense: null });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.read_only" } });
  });

  it("answers 404 to someone without a household, and buys nothing of anyone's", async () => {
    const { app } = createTestApp();
    const { ana, milk, eggs } = await shopping(app);
    const before = await listOf(app, ana);
    const outsider = await signIn(app, dani);

    const res = await finish(app, outsider, { itemIds: [milk.id, eggs.id], expense: null });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "household.not_member" } });
    expect(await listOf(app, ana)).toEqual(before);
  });

  it("never buys a cart that went back to the list because its owner became a guest at the same moment", async () => {
    const { app } = createTestApp();
    const { ana, bruno, milk, eggs } = await shopping(app);

    const [finished] = await Promise.all([
      finish(app, bruno, { itemIds: [milk.id, eggs.id], expense: null }),
      changeRole(app, ana, bruno.membershipId, "GUEST").expect(200),
    ]);

    const names = (await listOf(app, ana)).map((item) => item.name);
    if (finished.status === 200) {
      expect(names).toEqual(["Bread", "Rice"]);
    } else {
      expect([403, 409]).toContain(finished.status);
      expect(names).toEqual(["Milk", "Eggs", "Bread", "Rice"]);
    }
  });
});

describe("bought items", () => {
  it("can be added again by name, as new items", async () => {
    const { app } = createTestApp();
    const { ana, bruno, milk, eggs } = await shopping(app);
    await finish(app, bruno, { itemIds: [milk.id, eggs.id], expense: null }).expect(200);

    const again = await postItem(app, ana, { name: "milk" });

    expect(again.status).toBe(201);
    expect((await listOf(app, ana)).map((item) => item.name)).toEqual(["Bread", "Rice", "milk"]);
  });

  it("are gone for every change: editing, deleting, bringing back and moving in or out of a cart", async () => {
    const { app } = createTestApp();
    const { ana, bruno, milk, eggs } = await shopping(app);
    await finish(app, bruno, { itemIds: [milk.id, eggs.id], expense: null }).expect(200);

    for (const res of [
      await patchItem(app, bruno, milk.id, { note: "oat", version: 1 }),
      await deleteItem(app, bruno, milk),
      await restoreItem(app, bruno, milk.id),
      await putInCart(app, ana, milk.id),
      await takeOutOfCart(app, bruno, milk.id),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: "shopping.item.not_found" } });
    }
  });
});

const undo = (app: App, who: SignedIn, body: object) =>
  request(app).post("/api/household/shopping/finish/undo").set("Authorization", who.auth).send(body);

/** `shopping` with Bruno's cart (Milk and Eggs) just bought, and the items as they were in his cart. */
async function finished(app: App) {
  const home = await shopping(app);
  const { ana, bruno, milk, eggs } = home;
  const [milkInCart, eggsInCart] = await listOf(app, ana);
  await finish(app, bruno, { itemIds: [milk.id, eggs.id], expense: null }).expect(200);
  if (!milkInCart || !eggsInCart) throw new Error("Milk and Eggs come first");
  return { ...home, milk: milkInCart, eggs: eggsInCart };
}

describe("POST /api/household/shopping/finish/undo", () => {
  it("puts what the caller bought back in their cart, each item in its place on the list", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla, milk, eggs, bread, rice } = await finished(app);

    const res = await undo(app, bruno, { itemIds: [eggs.id, milk.id] });

    expect(res.status).toBe(200);
    expect(shoppingItemsResponseSchema.parse(res.body)).toEqual({ items: [milk, eggs] });
    for (const who of [ana, bruno, carla]) expect(await listOf(app, who)).toEqual([milk, eggs, bread, rice]);
  });

  it("allows it for a minute and then says it is too late", async () => {
    const { app, clock } = createTestApp();
    const { ana, bruno, milk, eggs, bread, rice } = await finished(app);

    clock.advance(60_000);
    await undo(app, bruno, { itemIds: [milk.id, eggs.id] }).expect(200);
    await finish(app, bruno, { itemIds: [milk.id, eggs.id], expense: null }).expect(200);
    clock.advance(60_001);
    const late = await undo(app, bruno, { itemIds: [milk.id, eggs.id] });

    expect(late.status).toBe(410);
    expect(late.body).toEqual({ error: { code: "shopping.undo.expired" } });
    expect(await listOf(app, ana)).toEqual([bread, rice]);
  });

  it("is only for whoever bought them: for anyone else it is too late", async () => {
    const { app } = createTestApp();
    const { ana, milk, eggs, bread, rice } = await finished(app);

    const res = await undo(app, ana, { itemIds: [milk.id, eggs.id] });

    expect(res.status).toBe(410);
    expect(res.body).toEqual({ error: { code: "shopping.undo.expired" } });
    expect(await listOf(app, ana)).toEqual([bread, rice]);
  });

  it("says it is too late for items that weren't bought, don't exist or belong to another household", async () => {
    const { app } = createTestApp();
    const { ana, bruno, milk, eggs, bread, rice } = await finished(app);
    const dan = await signIn(app, dani);
    await createHousehold(app, dan, "Piso Dani");
    const danMilk = await addItem(app, dan, "Milk");

    for (const extra of [rice.id, "item_missing", danMilk.id]) {
      const res = await undo(app, bruno, { itemIds: [milk.id, eggs.id, extra] });
      expect(res.status).toBe(410);
      expect(res.body).toEqual({ error: { code: "shopping.undo.expired" } });
    }
    expect(await listOf(app, ana)).toEqual([bread, rice]);
  });

  it("refuses when the same thing was added again meanwhile, keeping the new one and putting nothing back", async () => {
    const { app } = createTestApp();
    const { ana, bruno, milk, eggs, bread, rice } = await finished(app);
    const newMilk = await addItem(app, ana, "MILK");

    const res = await undo(app, bruno, { itemIds: [milk.id, eggs.id] });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "shopping.item.duplicate" } });
    expect(await listOf(app, ana)).toEqual([bread, rice, newMilk]);
  });

  it("changes nothing when the items are already back, as after a second tap", async () => {
    const { app } = createTestApp();
    const { bruno, milk, eggs } = await finished(app);
    const first = await undo(app, bruno, { itemIds: [milk.id, eggs.id] }).expect(200);

    const again = await undo(app, bruno, { itemIds: [milk.id, eggs.id] });

    expect(again.status).toBe(200);
    expect(again.body).toEqual(first.body);
  });

  it("refuses someone who became a guest after finishing, and the items stay bought", async () => {
    const { app } = createTestApp();
    const { ana, bruno, milk, eggs, bread, rice } = await finished(app);
    await changeRole(app, ana, bruno.membershipId, "GUEST").expect(200);

    const res = await undo(app, bruno, { itemIds: [milk.id, eggs.id] });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.read_only" } });
    expect(await listOf(app, ana)).toEqual([bread, rice]);
  });

  it("answers 404 to someone without a household, and request.invalid without items", async () => {
    const { app } = createTestApp();
    const { bruno, milk } = await finished(app);
    const outsider = await signIn(app, dani);

    const outside = await undo(app, outsider, { itemIds: [milk.id] });
    expect(outside.status).toBe(404);
    expect(outside.body).toEqual({ error: { code: "household.not_member" } });

    const empty = await undo(app, bruno, { itemIds: [] });
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ error: { code: "request.invalid" } });
  });
});

/** What the form would send to note what `who` paid: their purchase, split by the household's weights. */
async function purchase(who: SignedIn, overrides: Partial<ExpenseInput> = {}): Promise<ExpenseInput> {
  const amountCents = overrides.amountCents ?? 2400;
  return {
    description: "Milk and eggs",
    amountCents,
    currency: "EUR",
    paidById: who.user.id,
    date: TODAY,
    categoryId: null,
    split: { method: "WEIGHTS", previewShares: await previewSharesFor(who, amountCents, overrides.categoryId ?? null) },
    ...overrides,
  };
}

const getExpense = (app: App, who: SignedIn, id: string) =>
  request(app).get(`/api/household/expenses/${id}`).set("Authorization", who.auth);

describe("finishing with an expense", () => {
  it("records the expense and what was bought together, and takes the cart off the list", async () => {
    const { app } = createTestApp();
    const { ana, bruno, milk, eggs, bread, rice } = await shopping(app);
    await patchItem(app, bruno, milk.id, { note: "oat", version: 1 }).expect(200);

    const res = await finish(app, bruno, { itemIds: [eggs.id, milk.id], expense: await purchase(bruno) });

    expect(res.status).toBe(201);
    const { expense } = finishShoppingResponseSchema.parse(res.body);
    expect(expense).toEqual(
      expect.objectContaining({
        description: "Milk and eggs",
        amountCents: 2400,
        date: TODAY,
        boughtItems: [
          { name: "Milk", note: "oat" },
          { name: "Eggs", note: null },
        ],
      }),
    );
    expect(expense?.paidBy.userId).toBe(bruno.user.id);
    expect(sharesByUser(expenseOrThrow(expense))).toEqual({ [ana.user.id]: 1800, [bruno.user.id]: 600 });
    const saved = await getExpense(app, ana, expenseOrThrow(expense).id).expect(200);
    expect(expenseResponseSchema.parse(saved.body).expense).toEqual(expense);
    expect((await listOf(app, ana)).map((item) => item.id)).toEqual([bread.id, rice.id]);
  });

  it.each([
    ["a future date", 400, "money.date.future", (bruno: SignedIn) => purchase(bruno, { date: "2026-10-28" })],
    ["another currency", 409, "money.currency.mismatch", (bruno: SignedIn) => purchase(bruno, { currency: "USD" })],
    [
      "a payer from outside the household",
      400,
      "expense.person.not_member",
      (bruno: SignedIn) => purchase(bruno, { paidById: "user_outsider" }),
    ],
    [
      "shares that aren't the ones the split gives now",
      409,
      "expense.split.changed",
      async (bruno: SignedIn) => ({
        ...(await purchase(bruno)),
        split: { method: "WEIGHTS" as const, previewShares: [{ userId: bruno.user.id, amountCents: 2400 }] },
      }),
    ],
    [
      "a category of no household",
      400,
      "expense.category.not_found",
      (bruno: SignedIn) => purchase(bruno, { categoryId: "cat_missing" }),
    ],
  ])(
    "refuses %s like any expense, records nothing and leaves the cart as it was",
    async (_case, status, code, body) => {
      const { app } = createTestApp();
      const { ana, bruno, milk, eggs } = await shopping(app);
      const before = await listOf(app, ana);

      const res = await finish(app, bruno, { itemIds: [milk.id, eggs.id], expense: await body(bruno) });

      expect(res.status).toBe(status);
      expect(res.body).toEqual({ error: { code } });
      expect(await listOf(app, ana)).toEqual(before);
      expect(Object.values(balanceByUser(await balancesOf(app, ana))).every((cents) => cents === 0)).toBe(true);
    },
  );

  it("records nothing when the cart changed meanwhile", async () => {
    const { app } = createTestApp();
    const { ana, bruno, milk, eggs } = await shopping(app);
    const before = await listOf(app, ana);

    const res = await finish(app, bruno, { itemIds: [milk.id], expense: await purchase(bruno) });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "shopping.cart.changed" } });
    expect(await listOf(app, ana)).toEqual(before);
    expect(Object.values(balanceByUser(await balancesOf(app, ana))).every((cents) => cents === 0)).toBe(true);
    await finish(app, bruno, { itemIds: [milk.id, eggs.id], expense: await purchase(bruno) }).expect(201);
  });

  it("answers an error code to an expense that isn't valid, and buys nothing", async () => {
    const { app } = createTestApp();
    const { ana, bruno, milk, eggs } = await shopping(app);
    const before = await listOf(app, ana);

    const res = await finish(app, bruno, {
      itemIds: [milk.id, eggs.id],
      expense: { ...(await purchase(bruno)), amountCents: 0 },
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "money.amount.invalid" } });
    expect(await listOf(app, ana)).toEqual(before);
  });

  it("can't be undone: what was paid with an expense stays bought", async () => {
    const { app } = createTestApp();
    const { ana, bruno, milk, eggs, bread, rice } = await shopping(app);
    await finish(app, bruno, { itemIds: [milk.id, eggs.id], expense: await purchase(bruno) }).expect(201);

    const res = await undo(app, bruno, { itemIds: [milk.id, eggs.id] });

    expect(res.status).toBe(410);
    expect(res.body).toEqual({ error: { code: "shopping.undo.expired" } });
    expect((await listOf(app, ana)).map((item) => item.id)).toEqual([bread.id, rice.id]);
  });
});

describe("what was bought, on expenses", () => {
  it("is empty for an expense noted any other way", async () => {
    const { app } = createTestApp();
    const { ana } = await shopping(app);
    expect((await addExpense(app, ana)).boughtItems).toEqual([]);
  });

  it("never changes when the expense is edited, and the items stay bought when it is deleted", async () => {
    const { app } = createTestApp();
    const { ana, bruno, milk, eggs, bread, rice } = await shopping(app);
    const res = await finish(app, bruno, { itemIds: [milk.id, eggs.id], expense: await purchase(bruno) });
    const expense = expenseOrThrow(finishShoppingResponseSchema.parse(res.body).expense);

    const edited = await putExpense(app, ana, expense.id, {
      ...inputOf(expense),
      description: "The weekly shop",
      amountCents: 3000,
      version: expense.version,
    });
    expect(edited.status).toBe(200);
    expect(expenseResponseSchema.parse(edited.body).expense.boughtItems).toEqual(expense.boughtItems);

    await deleteExpense(app, ana, expense.id, expense.version + 1).expect(204);
    expect((await listOf(app, ana)).map((item) => item.id)).toEqual([bread.id, rice.id]);
    const undone = await undo(app, bruno, { itemIds: [milk.id, eggs.id] });
    expect(undone.status).toBe(410);
  });
});

describe("the category the next purchase starts with", () => {
  const lastCategoryOf = async (app: App, who: SignedIn) =>
    shoppingListSchema.parse((await getList(app, who).expect(200)).body).lastCategoryId;

  it("is none until something is paid for when finishing", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await shopping(app);
    const category = await addCategory(app, ana, "Supermarket");
    await addExpense(app, ana, { categoryId: category.id });

    expect(await lastCategoryOf(app, ana)).toBeNull();
    expect(await lastCategoryOf(app, carla)).toBeNull();
  });

  it("is the newest purchase's, for everyone, even with newer expenses that weren't purchases", async () => {
    const { app, clock } = createTestApp();
    const { ana, bruno, carla, milk, eggs, bread } = await shopping(app);
    const market = await addCategory(app, ana, "Market");
    const supermarket = await addCategory(app, ana, "Supermarket");
    const rent = await addCategory(app, ana, "Rent");
    await finish(app, bruno, {
      itemIds: [milk.id, eggs.id],
      expense: await purchase(bruno, { categoryId: market.id }),
    }).expect(201);
    clock.advance(1000);
    await finish(app, ana, {
      itemIds: [bread.id],
      expense: await purchase(ana, { categoryId: supermarket.id }),
    }).expect(201);
    clock.advance(1000);
    await addExpense(app, ana, { categoryId: rent.id });

    for (const who of [ana, bruno, carla]) expect(await lastCategoryOf(app, who)).toBe(supermarket.id);
  });

  it("skips a deleted purchase, and is none when the newest purchase's category was deleted", async () => {
    const { app, clock } = createTestApp();
    const { ana, bruno, milk, eggs, bread, rice } = await shopping(app);
    const market = await addCategory(app, ana, "Market");
    const supermarket = await addCategory(app, ana, "Supermarket");
    await finish(app, bruno, {
      itemIds: [milk.id, eggs.id],
      expense: await purchase(bruno, { categoryId: market.id }),
    }).expect(201);
    clock.advance(1000);
    const res = await finish(app, ana, {
      itemIds: [bread.id],
      expense: await purchase(ana, { categoryId: supermarket.id }),
    });
    const second = expenseOrThrow(finishShoppingResponseSchema.parse(res.body).expense);

    await deleteExpense(app, ana, second.id, second.version).expect(204);
    expect(await lastCategoryOf(app, ana)).toBe(market.id);

    await deleteCategory(app, ana, market.id, market.version).expect(204);
    expect(await lastCategoryOf(app, ana)).toBeNull();

    clock.advance(1000);
    await putInCart(app, ana, rice.id).expect(200);
    await finish(app, ana, {
      itemIds: [rice.id],
      expense: await purchase(ana, { categoryId: supermarket.id }),
    }).expect(201);
    expect(await lastCategoryOf(app, ana)).toBe(supermarket.id);
  });
});
function expenseOrThrow<T>(expense: T | null | undefined): T {
  if (!expense) throw new Error("finishing recorded no expense");
  return expense;
}
