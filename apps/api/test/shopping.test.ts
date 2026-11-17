import { shoppingItemResponseSchema, shoppingListSchema, type ShoppingItemView } from "@hogar/shared";
import { describe, expect, it } from "vitest";
import { homeWith, homeWithGuest } from "./expenseHelpers";
import { request } from "./request";
import { createHousehold } from "./householdHelpers";
import { createTestApp, dani, signIn, type SignedIn } from "./testApp";

type App = ReturnType<typeof createTestApp>["app"];

const getList = (app: App, who: SignedIn) => request(app).get("/api/household/shopping").set("Authorization", who.auth);

const postItem = (app: App, who: SignedIn, body: object) =>
  request(app).post("/api/household/shopping/items").set("Authorization", who.auth).send(body);

/** The caller's list, in order. */
async function listOf(app: App, who: SignedIn): Promise<ShoppingItemView[]> {
  const res = await getList(app, who);
  if (res.status !== 200) throw new Error(`listOf failed: ${res.status} ${JSON.stringify(res.body)}`);
  return shoppingListSchema.parse(res.body).items;
}

async function addItem(app: App, who: SignedIn, name: string, note: string | null = null) {
  const res = await postItem(app, who, { name, note });
  if (res.status !== 201) throw new Error(`addItem failed: ${res.status} ${JSON.stringify(res.body)}`);
  return shoppingItemResponseSchema.parse(res.body).item;
}

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
