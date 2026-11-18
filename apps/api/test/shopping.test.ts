import { shoppingItemResponseSchema } from "@hogar/shared";
import { describe, expect, it } from "vitest";
import { homeWith, homeWithGuest } from "./expenseHelpers";
import { request } from "./request";
import { createHousehold } from "./householdHelpers";
import {
  addItem,
  deleteItem,
  getList,
  itemPath,
  listOf,
  patchItem,
  postItem,
  putInCart,
  refOf,
  restoreItem,
  takeOutOfCart,
  type App,
} from "./shoppingHelpers";
import { createTestApp, dani, db, signIn, type SignedIn } from "./testApp";

describe("POST /api/household/shopping/items", () => {
  it("lets a member add an item that everyone in the household then sees, guests included", async () => {
    const { app, clock } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);

    const res = await postItem(app, bruno, { name: "  Milk ", note: " lactose-free " });

    expect(res.status).toBe(201);
    const item = shoppingItemResponseSchema.parse(res.body).item;
    expect(item).toEqual({
      id: expect.any(String),
      name: "Milk",
      note: "lactose-free",
      askedBy: { userId: bruno.user.id, name: "Bruno Díaz", avatarUrl: null, former: false },
      addedAt: clock.current.toISOString(),
      version: 1,
      cartOwner: null,
    });
    for (const who of [ana, bruno, carla]) expect(await listOf(app, who)).toEqual([item]);
  });
});

describe("GET /api/household/shopping", () => {
  it("lists the items in the order they were added, new ones last", async () => {
    const { app, clock } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    for (const [who, name] of [
      [ana, "Milk"],
      [bruno, "Eggs"],
      [ana, "Bread"],
    ] as const) {
      await addItem(app, who, name);
      clock.advance(1000);
    }
    expect((await listOf(app, bruno)).map((item) => item.name)).toEqual(["Milk", "Eggs", "Bread"]);
  });
});

describe("duplicates", () => {
  it.each(["milk", "MILK", "  Milk  ", "Mílk"])(
    "refuses %j while Milk is on the list, ignoring case, accents and spaces",
    async (name) => {
      const { app } = createTestApp();
      const { ana, bruno } = await homeWith(app);
      const milk = await addItem(app, ana, "Milk");
      const res = await postItem(app, bruno, { name, note: "lactose-free" });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: { code: "shopping.item.duplicate" } });
      expect(await listOf(app, ana)).toEqual([milk]);
    },
  );

  it("treats inner spaces like one", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    await addItem(app, ana, "Oat milk");
    expect((await postItem(app, ana, { name: "oat   MILK" })).body).toEqual({
      error: { code: "shopping.item.duplicate" },
    });
  });

  it("only counts the household's own list", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    await addItem(app, ana, "Milk");
    const dan = await signIn(app, dani);
    await createHousehold(app, dan, "Piso Dani");
    expect((await postItem(app, dan, { name: "Milk" })).status).toBe(201);
  });
});

describe("who can read and add", () => {
  it("lets an admin add too", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    expect((await postItem(app, ana, { name: "Milk" })).status).toBe(201);
  });

  it("refuses guests with a message written for them, and adds nothing", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    const res = await postItem(app, carla, { name: "Milk" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.read_only" } });
    expect(await listOf(app, ana)).toEqual([]);
  });

  it("answers 404 to someone without a household, and to someone who left", async () => {
    const { app } = createTestApp();
    const { bruno } = await homeWith(app);
    const outsider = await signIn(app, dani);
    expect((await request(app).post("/api/household/leave").set("Authorization", bruno.auth)).status).toBe(204);
    for (const who of [outsider, bruno]) {
      for (const res of [await getList(app, who), await postItem(app, who, { name: "Milk" })]) {
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: { code: "household.not_member" } });
      }
    }
  });

  it("shows each household only its own list", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    await addItem(app, ana, "Milk");
    const dan = await signIn(app, dani);
    await createHousehold(app, dan, "Piso Dani");
    const eggs = await addItem(app, dan, "Eggs");
    expect(await listOf(app, dan)).toEqual([eggs]);
    expect((await listOf(app, ana)).map((item) => item.name)).toEqual(["Milk"]);
  });

  it("refuses requests without a valid session", async () => {
    const { app } = createTestApp();
    expect((await request(app).get("/api/household/shopping")).status).toBe(401);
    expect((await request(app).post("/api/household/shopping/items").send({ name: "Milk" })).status).toBe(401);
  });
});

describe("names and notes", () => {
  it.each([
    ["an empty name", { name: "  " }, "shopping.item.name.required"],
    ["a name longer than 50 characters", { name: "a".repeat(51) }, "shopping.item.name.too_long"],
    ["a note longer than 100 characters", { name: "Milk", note: "b".repeat(101) }, "shopping.item.note.too_long"],
    ["a name that isn't text", { name: 42 }, "request.invalid"],
  ])("refuses %s with its error code", async (_, body, code) => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const res = await postItem(app, ana, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code } });
    expect(await listOf(app, ana)).toEqual([]);
  });

  it("keeps no note when it is empty", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    expect(await addItem(app, ana, "Milk", "   ")).toMatchObject({ name: "Milk", note: null });
  });

  it("keeps the name of whoever asked after they leave the household", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    await addItem(app, bruno, "Milk");
    await request(app).post("/api/household/leave").set("Authorization", bruno.auth);
    expect((await listOf(app, ana))[0]?.askedBy).toEqual({
      userId: bruno.user.id,
      name: "Bruno Díaz",
      avatarUrl: null,
      former: true,
    });
  });
});

describe("who asked for each item", () => {
  const setShowWhoAsked = (app: App, who: SignedIn, showWhoAsked: boolean) =>
    request(app).patch("/api/household").set("Authorization", who.auth).send({ showWhoAsked });

  it("leaves who asked out of every item view while an admin hides it, and shows it again, never deleted", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    await addItem(app, bruno, "Milk");
    expect((await setShowWhoAsked(app, ana, false)).status).toBe(200);

    const eggs = await addItem(app, ana, "Eggs");
    expect(eggs).not.toHaveProperty("askedBy");
    for (const who of [ana, bruno, carla]) {
      const { items } = (await getList(app, who)).body as { items: object[] };
      expect(items).toHaveLength(2);
      for (const item of items) expect(item).not.toHaveProperty("askedBy");
    }

    expect((await setShowWhoAsked(app, ana, true)).status).toBe(200);
    expect((await listOf(app, carla)).map((item) => [item.name, item.askedBy?.name])).toEqual([
      ["Milk", "Bruno Díaz"],
      ["Eggs", "Ana García"],
    ]);
  });
});

describe("DELETE /api/household/shopping/items/:id", () => {
  it("takes the item off everyone's list at once", async () => {
    const { app, clock } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    const milk = await addItem(app, ana, "Milk");
    clock.advance(1000);
    const eggs = await addItem(app, ana, "Eggs");

    const res = await deleteItem(app, bruno, milk);

    expect(res.status).toBe(204);
    for (const who of [ana, bruno, carla]) expect(await listOf(app, who)).toEqual([eggs]);
  });

  it("refuses a delete based on an older version, keeping the item", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    await patchItem(app, ana, milk.id, { note: "lactose-free", version: 1 }).expect(200);

    const res = await deleteItem(app, bruno, milk);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "shopping.item.changed" } });
    expect(await listOf(app, ana)).toEqual([{ ...milk, note: "lactose-free", version: 2 }]);
  });

  it("answers that the item is gone when it was already deleted, doesn't exist or belongs to another household", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    const dan = await signIn(app, dani);
    await createHousehold(app, dan, "Piso Dani");
    const eggs = await addItem(app, dan, "Eggs");
    await deleteItem(app, ana, milk).expect(204);

    for (const res of [
      await deleteItem(app, bruno, milk),
      await deleteItem(app, bruno, { id: "item_missing", version: 1 }),
      await deleteItem(app, bruno, eggs),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: "shopping.item.not_found" } });
    }
    expect(await listOf(app, dan)).toEqual([eggs]);
  });

  it("needs the version the person saw", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    const res = await request(app).delete(itemPath(milk.id)).set("Authorization", ana.auth);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "request.invalid" } });
  });

  it("refuses guests and keeps the item", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    const milk = await addItem(app, ana, "Milk");
    const res = await deleteItem(app, carla, milk);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.read_only" } });
    expect(await listOf(app, ana)).toEqual([milk]);
  });

  it("lets the same thing be added again as a new item once it was deleted", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    await deleteItem(app, ana, milk).expect(204);

    const again = await addItem(app, bruno, "milk", "oat");

    expect(again.id).not.toBe(milk.id);
    expect(await listOf(app, ana)).toEqual([again]);
  });
});

describe("PATCH /api/household/shopping/items/:id", () => {
  it("changes the name and the note from the version the person saw, for everyone", async () => {
    const { app, clock } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    const milk = await addItem(app, ana, "Milk");
    clock.advance(1000);
    const eggs = await addItem(app, ana, "Eggs");

    const res = await patchItem(app, bruno, milk.id, { name: " Oat milk ", note: " 2 cartons ", version: 1 });

    expect(res.status).toBe(200);
    const edited = shoppingItemResponseSchema.parse(res.body).item;
    expect(edited).toEqual({ ...milk, name: "Oat milk", note: "2 cartons", version: 2 });
    for (const who of [ana, bruno, carla]) expect(await listOf(app, who)).toEqual([edited, eggs]);
  });

  it("changes only the note, keeping the name, and removes it when left empty", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");

    const noted = await patchItem(app, ana, milk.id, { note: "lactose-free", version: 1 });
    expect(noted.body).toEqual({ item: { ...milk, note: "lactose-free", version: 2 } });

    const blank = await patchItem(app, ana, milk.id, { note: "   ", version: 2 });
    expect(blank.body).toEqual({ item: { ...milk, note: null, version: 3 } });

    await patchItem(app, ana, milk.id, { note: "oat", version: 3 }).expect(200);
    const cleared = await patchItem(app, ana, milk.id, { note: null, version: 4 });
    expect(cleared.body).toEqual({ item: { ...milk, note: null, version: 5 } });
  });

  it("refuses an edit based on an older version, keeping the other person's change", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    await patchItem(app, ana, milk.id, { note: "lactose-free", version: 1 }).expect(200);

    const res = await patchItem(app, bruno, milk.id, { name: "Oat milk", version: 1 });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "shopping.item.changed" } });
    expect(await listOf(app, ana)).toEqual([{ ...milk, note: "lactose-free", version: 2 }]);
  });

  it.each(["eggs", "  EGGS ", "Éggs"])("refuses renaming to %j while Eggs is on the list", async (name) => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    await addItem(app, ana, "Eggs");

    const res = await patchItem(app, bruno, milk.id, { name, version: 1 });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "shopping.item.duplicate" } });
    expect((await listOf(app, ana)).map((item) => item.name)).toEqual(["Milk", "Eggs"]);
  });

  it("lets an item be renamed to its own name written differently", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const milk = await addItem(app, ana, "milk");
    expect((await patchItem(app, ana, milk.id, { name: "Milk", version: 1 })).body).toEqual({
      item: { ...milk, name: "Milk", version: 2 },
    });
  });

  it("changes nothing, not even the version, when saving what is already there", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk", "lactose-free");

    const res = await patchItem(app, bruno, milk.id, { name: " Milk", note: "lactose-free ", version: 1 });

    expect(res.body).toEqual({ item: milk });
    expect(await listOf(app, ana)).toEqual([milk]);
  });

  it("answers that the item is gone when it was deleted, doesn't exist or belongs to another household", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    const dan = await signIn(app, dani);
    await createHousehold(app, dan, "Piso Dani");
    const eggs = await addItem(app, dan, "Eggs");
    await deleteItem(app, ana, milk).expect(204);

    for (const id of [milk.id, "item_missing", eggs.id]) {
      const res = await patchItem(app, bruno, id, { name: "Bread", version: 1 });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: "shopping.item.not_found" } });
    }
    expect(await listOf(app, dan)).toEqual([eggs]);
  });

  it("refuses guests and changes nothing", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    const milk = await addItem(app, ana, "Milk");
    const res = await patchItem(app, carla, milk.id, { name: "Oat milk", version: 1 });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.read_only" } });
    expect(await listOf(app, ana)).toEqual([milk]);
  });

  it.each([
    ["an empty name", { name: " ", version: 1 }, "shopping.item.name.required"],
    ["a name longer than 50 characters", { name: "a".repeat(51), version: 1 }, "shopping.item.name.too_long"],
    ["a note longer than 100 characters", { note: "b".repeat(101), version: 1 }, "shopping.item.note.too_long"],
    ["neither a name nor a note", { version: 1 }, "request.invalid"],
    ["no version", { name: "Oat milk" }, "request.invalid"],
  ])("refuses %s with its error code", async (_, body, code) => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    const res = await patchItem(app, ana, milk.id, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code } });
    expect(await listOf(app, ana)).toEqual([milk]);
  });
});

describe("POST /api/household/shopping/items/:id/restore", () => {
  it("brings the item back in its place, as it was, for whoever deleted it", async () => {
    const { app, clock } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk", "lactose-free");
    clock.advance(1000);
    const eggs = await addItem(app, ana, "Eggs");
    await deleteItem(app, bruno, milk).expect(204);
    clock.advance(30_000);

    const res = await restoreItem(app, bruno, milk.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ item: milk });
    expect(await listOf(app, ana)).toEqual([milk, eggs]);
  });

  it("allows it for a minute and then says it is too late", async () => {
    const { app, clock } = createTestApp();
    const { ana } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    const eggs = await addItem(app, ana, "Eggs");
    await deleteItem(app, ana, milk).expect(204);
    await deleteItem(app, ana, eggs).expect(204);

    clock.advance(60_000);
    await restoreItem(app, ana, milk.id).expect(200);
    clock.advance(1);
    const late = await restoreItem(app, ana, eggs.id);

    expect(late.status).toBe(410);
    expect(late.body).toEqual({ error: { code: "shopping.undo.expired" } });
    expect(await listOf(app, ana)).toEqual([milk]);
  });

  it("is only for whoever deleted it: for anyone else the item is gone", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    await deleteItem(app, ana, milk).expect(204);

    const res = await restoreItem(app, bruno, milk.id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "shopping.item.not_found" } });
    expect(await listOf(app, ana)).toEqual([]);
  });

  it("refuses when the same thing was added again meanwhile, keeping the new one", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    await deleteItem(app, ana, milk).expect(204);
    const again = await addItem(app, bruno, "MILK", "oat");

    const res = await restoreItem(app, ana, milk.id);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "shopping.item.duplicate" } });
    expect(await listOf(app, ana)).toEqual([again]);
  });

  it("changes nothing when the item is already back, as after a second tap", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    await deleteItem(app, ana, milk).expect(204);
    await restoreItem(app, ana, milk.id).expect(200);

    const again = await restoreItem(app, ana, milk.id);

    expect(again.status).toBe(200);
    expect(again.body).toEqual({ item: milk });
    expect(await listOf(app, ana)).toEqual([milk]);
  });

  it("answers that the item is gone when it doesn't exist or belongs to another household", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const dan = await signIn(app, dani);
    await createHousehold(app, dan, "Piso Dani");
    const eggs = await addItem(app, dan, "Eggs");
    await deleteItem(app, dan, eggs).expect(204);

    for (const id of ["item_missing", eggs.id]) {
      const res = await restoreItem(app, ana, id);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: "shopping.item.not_found" } });
    }
  });

  it("refuses someone who became a guest after deleting, and keeps the item off the list", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, bruno, "Milk");
    await deleteItem(app, bruno, milk).expect(204);
    await request(app)
      .patch(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth)
      .send({ role: "GUEST" })
      .expect(200);

    const res = await restoreItem(app, bruno, milk.id);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.read_only" } });
    expect(await listOf(app, ana)).toEqual([]);
  });
});

describe("PUT /api/household/shopping/items/:id/cart", () => {
  it("puts the item in the caller's cart, for everyone to see, without counting it as an edit", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    const milk = await addItem(app, ana, "Milk");
    expect(milk.cartOwner).toBeNull();

    const res = await putInCart(app, bruno, milk.id);

    expect(res.status).toBe(200);
    const inCart = { ...milk, cartOwner: refOf(bruno, "Bruno Díaz") };
    expect(res.body).toEqual({ item: inCart });
    for (const who of [ana, bruno, carla]) expect(await listOf(app, who)).toEqual([inCart]);
  });
});

describe("carts: who gets an item", () => {
  it("gives the item to whoever tapped first when two people tap it at once, and tells the other whose it is", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");

    const results = await Promise.all([putInCart(app, ana, milk.id), putInCart(app, bruno, milk.id)]);

    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([200, 409]);
    const refused = results.find((res) => res.status === 409);
    expect(refused?.body).toEqual({ error: { code: "shopping.item.in_cart" } });
    const winner = results.find((res) => res.status === 200);
    const owner = shoppingItemResponseSchema.parse(winner?.body).item.cartOwner;
    expect((await listOf(app, ana))[0]?.cartOwner).toEqual(owner);
  });

  it("changes nothing on a second tap by the same person", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    const first = await putInCart(app, ana, milk.id).expect(200);

    const again = await putInCart(app, ana, milk.id);

    expect(again.status).toBe(200);
    expect(again.body).toEqual(first.body);
  });

  it("refuses an item already in someone else's cart, which stays theirs", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    await putInCart(app, bruno, milk.id).expect(200);

    const res = await putInCart(app, ana, milk.id);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "shopping.item.in_cart" } });
    expect((await listOf(app, ana))[0]?.cartOwner).toEqual(refOf(bruno, "Bruno Díaz"));
  });

  it("refuses guests, whose cart stays empty", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    const milk = await addItem(app, ana, "Milk");

    const res = await putInCart(app, carla, milk.id);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.read_only" } });
    expect(await listOf(app, ana)).toEqual([milk]);
  });

  it("answers that the item is gone when it was deleted, doesn't exist or belongs to another household", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    const dan = await signIn(app, dani);
    await createHousehold(app, dan, "Piso Dani");
    const eggs = await addItem(app, dan, "Eggs");
    await deleteItem(app, ana, milk).expect(204);

    for (const id of [milk.id, "item_missing", eggs.id]) {
      for (const res of [await putInCart(app, bruno, id), await takeOutOfCart(app, bruno, id)]) {
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: { code: "shopping.item.not_found" } });
      }
    }
    expect(await listOf(app, dan)).toEqual([eggs]);
  });

  it("answers 404 to someone without a household", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    const outsider = await signIn(app, dani);
    for (const res of [await putInCart(app, outsider, milk.id), await takeOutOfCart(app, outsider, milk.id)]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: "household.not_member" } });
    }
  });
});

describe("DELETE /api/household/shopping/items/:id/cart", () => {
  it("puts the item back on the list, still to buy, when its owner takes it out", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    await putInCart(app, bruno, milk.id).expect(200);

    const res = await takeOutOfCart(app, bruno, milk.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ item: milk });
    expect(await listOf(app, ana)).toEqual([milk]);
  });
});

describe("carts: only the owner takes an item out", () => {
  it("refuses anyone else, admins included, and the item stays in its owner's cart", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    await putInCart(app, bruno, milk.id).expect(200);

    const res = await takeOutOfCart(app, ana, milk.id);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "shopping.item.in_cart" } });
    expect((await listOf(app, ana))[0]?.cartOwner).toEqual(refOf(bruno, "Bruno Díaz"));
  });

  it("changes nothing for an item in nobody's cart, as after a second tap", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    const res = await takeOutOfCart(app, ana, milk.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ item: milk });
  });

  it("refuses guests", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    const milk = await addItem(app, ana, "Milk");
    const res = await takeOutOfCart(app, carla, milk.id);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.read_only" } });
  });

  it("never counts moving in or out of a cart as an edit, so an edit from before still saves", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    await putInCart(app, ana, milk.id).expect(200);
    await takeOutOfCart(app, ana, milk.id).expect(200);
    await putInCart(app, ana, milk.id).expect(200);
    await takeOutOfCart(app, ana, milk.id).expect(200);

    const res = await patchItem(app, bruno, milk.id, { note: "oat", version: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ item: { ...milk, note: "oat", version: 2 } });
  });
});

describe("carts: only the owner changes or deletes an item meanwhile", () => {
  it("refuses an edit by anyone else, keeping the item as it was", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    const inCart = shoppingItemResponseSchema.parse((await putInCart(app, bruno, milk.id)).body).item;

    const res = await patchItem(app, ana, milk.id, { note: "oat", version: 1 });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "shopping.item.in_cart" } });
    expect(await listOf(app, ana)).toEqual([inCart]);
  });

  it("refuses a delete by anyone else, keeping the item", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    const inCart = shoppingItemResponseSchema.parse((await putInCart(app, bruno, milk.id)).body).item;

    const res = await deleteItem(app, ana, milk);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "shopping.item.in_cart" } });
    expect(await listOf(app, ana)).toEqual([inCart]);
  });

  it("lets the owner edit it, still in their cart", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    await putInCart(app, bruno, milk.id).expect(200);

    const res = await patchItem(app, bruno, milk.id, { note: "oat", version: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ item: { ...milk, note: "oat", version: 2, cartOwner: refOf(bruno, "Bruno Díaz") } });
  });

  it("lets the owner delete it, and undo brings it back into their cart", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    const inCart = shoppingItemResponseSchema.parse((await putInCart(app, bruno, milk.id)).body).item;

    await deleteItem(app, bruno, milk).expect(204);
    expect(await listOf(app, ana)).toEqual([]);
    const res = await restoreItem(app, bruno, milk.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ item: inCart });
    expect(await listOf(app, ana)).toEqual([inCart]);
  });

  it("refuses to bring back an item someone else holds in their cart", async () => {
    // The API never lets this happen (a deleted item can't go into a cart); the rule still holds.
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const milk = await addItem(app, ana, "Milk");
    await deleteItem(app, ana, milk).expect(204);
    await db.shoppingItem.update({ where: { id: milk.id }, data: { cartOwnerId: bruno.user.id } });

    const res = await restoreItem(app, ana, milk.id);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "shopping.item.in_cart" } });
    expect(await listOf(app, ana)).toEqual([]);
  });
});

describe("carts go back to the list", () => {
  const changeRole = (app: App, admin: SignedIn, membershipId: string, role: string) =>
    request(app).patch(`/api/household/members/${membershipId}`).set("Authorization", admin.auth).send({ role });

  /** Milk and Eggs in Bruno's cart, Bread in Ana's. */
  async function shopping(app: App) {
    const home = await homeWith(app);
    const { ana, bruno } = home;
    const milk = await addItem(app, ana, "Milk");
    const eggs = await addItem(app, ana, "Eggs");
    const bread = await addItem(app, bruno, "Bread");
    await putInCart(app, bruno, milk.id).expect(200);
    await putInCart(app, bruno, eggs.id).expect(200);
    await putInCart(app, ana, bread.id).expect(200);
    return { ...home, milk, eggs, bread };
  }

  const cartsOf = async (app: App, who: SignedIn) =>
    (await listOf(app, who)).map((item) => [item.name, item.cartOwner?.name ?? null]);

  it("when someone becomes a guest: their cart only, still to buy and unedited", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await shopping(app);

    await changeRole(app, ana, bruno.membershipId, "GUEST").expect(200);

    expect(await cartsOf(app, ana)).toEqual([
      ["Milk", null],
      ["Eggs", null],
      ["Bread", "Ana García"],
    ]);
    expect((await listOf(app, ana)).map((item) => item.version)).toEqual([1, 1, 1]);
  });

  it("never leaves an item in the cart of someone who becomes a guest at the same moment", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    for (const name of ["Milk", "Eggs", "Bread", "Rice", "Salt"]) {
      const item = await addItem(app, ana, name);
      await changeRole(app, ana, bruno.membershipId, "MEMBER").expect(200);

      const [cart] = await Promise.all([
        putInCart(app, bruno, item.id),
        changeRole(app, ana, bruno.membershipId, "GUEST").expect(200),
      ]);

      expect([200, 403]).toContain(cart.status);
      expect((await listOf(app, ana)).every((other) => other.cartOwner === null)).toBe(true);
    }
  });

  it("keeps the cart of someone who becomes an admin or stays a member", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await shopping(app);

    await changeRole(app, ana, bruno.membershipId, "ADMIN").expect(200);
    await changeRole(app, ana, bruno.membershipId, "MEMBER").expect(200);

    expect(await cartsOf(app, ana)).toEqual([
      ["Milk", "Bruno Díaz"],
      ["Eggs", "Bruno Díaz"],
      ["Bread", "Ana García"],
    ]);
  });

  it("when someone leaves", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await shopping(app);

    await request(app).post("/api/household/leave").set("Authorization", bruno.auth).expect(204);

    expect(await cartsOf(app, ana)).toEqual([
      ["Milk", null],
      ["Eggs", null],
      ["Bread", "Ana García"],
    ]);
  });

  it("when an admin removes someone", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await shopping(app);

    await request(app)
      .delete(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth)
      .expect(200);

    expect(await cartsOf(app, ana)).toEqual([
      ["Milk", null],
      ["Eggs", null],
      ["Bread", "Ana García"],
    ]);
  });

  it("also for an item they deleted from their cart, so undo can't put it back in a cart they no longer have", async () => {
    const { app } = createTestApp();
    const { ana, bruno, milk } = await shopping(app);
    await deleteItem(app, bruno, milk).expect(204);

    await changeRole(app, ana, bruno.membershipId, "GUEST").expect(200);
    await changeRole(app, ana, bruno.membershipId, "MEMBER").expect(200);
    await restoreItem(app, bruno, milk.id).expect(200);

    expect((await listOf(app, ana)).find((item) => item.id === milk.id)?.cartOwner).toBeNull();
  });
});
