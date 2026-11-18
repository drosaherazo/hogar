import { shoppingSuggestionsSchema } from "@hogar/shared";
import { describe, expect, it } from "vitest";
import { homeWith, homeWithGuest } from "./expenseHelpers";
import { createHousehold } from "./householdHelpers";
import { request } from "./request";
import { addItem, deleteItem, putInCart, type App } from "./shoppingHelpers";
import { createTestApp, dani, signIn, type SignedIn } from "./testApp";

const getSuggestions = (app: App, who: SignedIn, q?: string) =>
  request(app)
    .get("/api/household/shopping/suggestions")
    .query(q === undefined ? {} : { q })
    .set("Authorization", who.auth);

async function suggestionsFor(app: App, who: SignedIn, q?: string) {
  const res = await getSuggestions(app, who, q);
  if (res.status !== 200) throw new Error(`suggestionsFor failed: ${res.status} ${JSON.stringify(res.body)}`);
  return shoppingSuggestionsSchema.parse(res.body).suggestions;
}

/** Adds an item, puts it in `who`'s cart and finishes shopping without an expense. */
async function buy(app: App, who: SignedIn, name: string, note: string | null = null) {
  const item = await addItem(app, who, name, note);
  await putInCart(app, who, item.id).expect(200);
  await request(app)
    .post("/api/household/shopping/finish")
    .set("Authorization", who.auth)
    .send({ itemIds: [item.id], expense: null })
    .expect(200);
  return item;
}

/** Buys each name in turn, a minute apart, so "most recent" is well defined. */
async function buyAll(app: App, clock: { advance(ms: number): void }, who: SignedIn, names: readonly string[]) {
  for (const name of names) {
    await buy(app, who, name);
    clock.advance(60_000);
  }
}

const names = (suggestions: { name: string }[]) => suggestions.map((suggestion) => suggestion.name);

describe("GET /api/household/shopping/suggestions", () => {
  it("matches bought items anywhere in the name, ignoring case and accents", async () => {
    const { app, clock } = createTestApp();
    const { ana } = await homeWith(app);
    await buyAll(app, clock, ana, ["Leche", "Lechuga", "Pan", "Café con leche"]);

    for (const q of ["lec", "LEC", "léc", "  lec "]) {
      expect(names(await suggestionsFor(app, ana, q)).sort()).toEqual(["Café con leche", "Leche", "Lechuga"]);
    }
    expect(names(await suggestionsFor(app, ana, "cafe"))).toEqual(["Café con leche"]);
    expect(await suggestionsFor(app, ana, "rice")).toEqual([]);
  });

  it("groups purchases of the same name, counting each, with the name and note of the latest", async () => {
    const { app, clock } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    await buy(app, ana, "milk", "lactose-free");
    clock.advance(60_000);
    await buy(app, bruno, "MILK ", null);
    clock.advance(60_000);
    await buy(app, ana, "Mílk", "2 packs");

    expect(await suggestionsFor(app, bruno, "mil")).toEqual([{ name: "Mílk", note: "2 packs", timesBought: 3 }]);
  });

  it("sorts by times bought, then by the most recent purchase, and gives at most five", async () => {
    const { app, clock } = createTestApp();
    const { ana } = await homeWith(app);
    await buyAll(app, clock, ana, ["Rice", "Eggs", "Bread", "Eggs", "Milk", "Tea", "Jam", "Oil", "Eggs", "Rice"]);

    const suggestions = await suggestionsFor(app, ana);

    expect(suggestions.map(({ name, timesBought }) => [name, timesBought])).toEqual([
      ["Eggs", 3],
      ["Rice", 2],
      ["Oil", 1],
      ["Jam", 1],
      ["Tea", 1],
    ]);
  });

  it("leaves out what is already on the list, ignoring case, accents and spaces", async () => {
    const { app, clock } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    await buyAll(app, clock, ana, ["Milk", "Milk chocolate"]);
    await addItem(app, bruno, "  MÍLK ");

    expect(names(await suggestionsFor(app, ana, "milk"))).toEqual(["Milk chocolate"]);
  });

  it("suggests it again once it leaves the list", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    await buy(app, ana, "Milk");
    const again = await addItem(app, ana, "Milk");
    expect(await suggestionsFor(app, ana, "milk")).toEqual([]);

    await deleteItem(app, ana, again).expect(204);

    expect(await suggestionsFor(app, ana, "milk")).toEqual([{ name: "Milk", note: null, timesBought: 1 }]);
  });

  it("never suggests or counts items that were deleted or are only on the list", async () => {
    const { app, clock } = createTestApp();
    const { ana } = await homeWith(app);
    await buy(app, ana, "Milk", "whole");
    clock.advance(60_000);
    const mistake = await addItem(app, ana, "Mlik");
    await deleteItem(app, ana, mistake).expect(204);
    const deletedMilk = await addItem(app, ana, "milk", "oat");
    await putInCart(app, ana, deletedMilk.id).expect(200);
    await deleteItem(app, ana, deletedMilk).expect(204);
    await addItem(app, ana, "Mil hojas");

    expect(await suggestionsFor(app, ana, "m")).toEqual([{ name: "Milk", note: "whole", timesBought: 1 }]);
  });

  it("forgets a purchase whose finish was undone", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const milk = await buy(app, ana, "Milk");
    await request(app)
      .post("/api/household/shopping/finish/undo")
      .set("Authorization", ana.auth)
      .send({ itemIds: [milk.id] })
      .expect(200);
    await deleteItem(app, ana, milk).expect(204);

    expect(await suggestionsFor(app, ana, "milk")).toEqual([]);
  });

  it("reads only the caller's own household", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    await buy(app, ana, "Milk");
    const dan = await signIn(app, dani);
    await createHousehold(app, dan, "Casa Dani");
    await buy(app, dan, "Milkshake");

    expect(names(await suggestionsFor(app, ana, "milk"))).toEqual(["Milk"]);
    expect(names(await suggestionsFor(app, dan, "milk"))).toEqual(["Milkshake"]);
  });

  it("is open to guests, since they can read the list", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    await buy(app, ana, "Milk");

    expect(names(await suggestionsFor(app, carla, "mi"))).toEqual(["Milk"]);
  });

  it("refuses someone without a household, and a query longer than any name", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const outsider = await signIn(app, dani);

    const res = await getSuggestions(app, outsider, "milk");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "household.not_member" } });

    const tooLong = await getSuggestions(app, ana, "a".repeat(51));
    expect(tooLong.status).toBe(400);
    expect(tooLong.body).toEqual({ error: { code: "request.invalid" } });
  });

  it("refuses an anonymous caller", async () => {
    const { app } = createTestApp();
    expect((await request(app).get("/api/household/shopping/suggestions?q=milk")).status).toBe(401);
  });
});
