import { finishShoppingResponseSchema, shoppingItemResponseSchema, shoppingItemsResponseSchema } from "@hogar/shared";
import { describe, expect, it } from "vitest";
import { homeWithGuest } from "./expenseHelpers";
import { createHousehold } from "./householdHelpers";
import { request } from "./request";
import {
  addItem,
  deleteItem,
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
