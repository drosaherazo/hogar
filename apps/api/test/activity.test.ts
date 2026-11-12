import { activityPageSchema } from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHousehold } from "./householdHelpers";
import { categoryNamed } from "./categoryHelpers";
import { addExpense, addSettlement, deleteExpense, homeWith, homeWithGuest } from "./expenseHelpers";
import { createTestApp, dani, signIn, type SignedIn } from "./testApp";

type App = ReturnType<typeof createTestApp>["app"];

async function activity(app: App, who: SignedIn, query: Record<string, string> = {}) {
  const res = await request(app).get("/api/household/activity").query(query).set("Authorization", who.auth);
  expect(res.status).toBe(200);
  return activityPageSchema.parse(res.body);
}

const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);

describe("GET /api/household/activity", () => {
  it("lists the newest first, each with the viewer's own part", async () => {
    const { app, clock } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const groceries = await addExpense(app, ana, { description: "Groceries", amountCents: 4280, date: "2026-10-20" });
    const bread = await addExpense(app, bruno, { description: "Bread", amountCents: 400, date: "2026-10-25" });
    clock.advance(1000);
    // Same day as the bread, recorded later: it comes first.
    const dinner = await addExpense(app, ana, { description: "Dinner", amountCents: 2000, date: "2026-10-25" });

    const page = await activity(app, bruno);
    expect(ids(page.items)).toEqual([dinner.id, bread.id, groceries.id]);
    expect(page.nextCursor).toBeNull();

    const parts = Object.fromEntries(
      page.items.map((item) => [item.id, item.kind === "expense" ? item.viewerPart : null]),
    );
    expect(parts[groceries.id]).toEqual({ kind: "owes", amountCents: 1070 });
    // Bruno paid €4.00 for the bread and his share is €1.00, so he lent €3.00.
    expect(parts[bread.id]).toEqual({ kind: "lent", amountCents: 300 });
    expect(page.items[0]).toEqual(
      expect.objectContaining({
        kind: "expense",
        description: "Dinner",
        amountCents: 2000,
        date: "2026-10-25",
        deleted: null,
      }),
    );
  });

  it("pages through the history without repeats or gaps, even when records are added meanwhile", async () => {
    const { app, clock } = createTestApp();
    const { ana } = await homeWith(app);
    const recorded = [];
    for (const day of ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]) {
      recorded.push(await addExpense(app, ana, { description: `Expense ${day}`, date: day }));
      clock.advance(1000);
    }
    const newestFirst = ids(recorded).reverse();

    const first = await activity(app, ana, { limit: "2" });
    expect(ids(first.items)).toEqual(newestFirst.slice(0, 2));
    expect(first.nextCursor).not.toBeNull();

    // Someone records a new expense between pages: the next pages neither repeat nor skip anything.
    await addExpense(app, ana, { description: "Late", date: "2026-10-26" });

    const second = await activity(app, ana, { limit: "2", cursor: first.nextCursor ?? "" });
    const third = await activity(app, ana, { limit: "2", cursor: second.nextCursor ?? "" });
    expect(ids([...first.items, ...second.items, ...third.items])).toEqual(newestFirst);
    expect(third.nextCursor).toBeNull();
  });

  it("refuses a cursor it didn't make and a limit out of range", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    for (const query of [{ cursor: "garbage" }, { limit: "0" }, { limit: "51" }]) {
      const res = await request(app).get("/api/household/activity").query(query).set("Authorization", ana.auth);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: { code: "request.invalid" } });
    }
  });

  it("shows guests the history too", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    const expense = await addExpense(app, ana);
    expect(ids((await activity(app, carla)).items)).toEqual([expense.id]);
  });

  it("never shows another household's records", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    await addExpense(app, ana);
    const outsider = await signIn(app, dani);
    await createHousehold(app, outsider, "Piso Dani");
    const own = await addExpense(app, outsider, { description: "Dani's rent" });
    expect(ids((await activity(app, outsider)).items)).toEqual([own.id]);
  });

  it("refuses someone without a household", async () => {
    const { app } = createTestApp();
    const outsider = await signIn(app, dani);
    const res = await request(app).get("/api/household/activity").set("Authorization", outsider.auth);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "household.not_member" } });
  });
});

describe("categories in the history", () => {
  it("shows each expense's category, and nothing on payments", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const groceries = await categoryNamed(app, ana, "Comida");
    const shop = await addExpense(app, ana, { categoryId: groceries.id });
    const coffee = await addExpense(app, ana, { description: "Coffee" });
    await addSettlement(app, ana, { fromUserId: bruno.user.id, toUserId: ana.user.id });

    const page = await activity(app, bruno);
    const byId = Object.fromEntries(page.items.map((item) => [item.id, item]));
    expect(byId[shop.id]).toEqual(
      expect.objectContaining({ category: { id: groceries.id, name: "Comida", emoji: "🛒" } }),
    );
    expect(byId[coffee.id]).toEqual(expect.objectContaining({ category: null }));
    const payment = page.items.find((item) => item.kind === "settlement");
    expect(payment).toBeDefined();
    expect(payment).not.toHaveProperty("category");
  });
});

describe("GET /api/household/activity?category=", () => {
  async function history(app: App) {
    const home = await homeWith(app);
    const { ana, bruno } = home;
    const rent = await categoryNamed(app, ana, "Alquiler");
    const groceries = await categoryNamed(app, ana, "Comida");
    const march = await addExpense(app, ana, { description: "March rent", categoryId: rent.id, date: "2026-10-01" });
    const shop = await addExpense(app, ana, { description: "Shop", categoryId: groceries.id, date: "2026-10-02" });
    const coffee = await addExpense(app, bruno, { description: "Coffee", date: "2026-10-03" });
    const april = await addExpense(app, ana, { description: "April rent", categoryId: rent.id, date: "2026-10-04" });
    await deleteExpense(app, ana, april.id, 1);
    await addSettlement(app, ana, { fromUserId: bruno.user.id, toUserId: ana.user.id });
    return { ...home, rent, groceries, march, shop, coffee, april };
  }

  it("lists only that category's expenses, deleted ones included, without payments", async () => {
    const { app } = createTestApp();
    const { bruno, rent, march, april } = await history(app);
    const page = await activity(app, bruno, { category: rent.id });
    expect(ids(page.items)).toEqual([april.id, march.id]);
    expect(page.items.every((item) => item.kind === "expense")).toBe(true);
  });

  it("lists only expenses without a category for `none`", async () => {
    const { app } = createTestApp();
    const { ana, coffee } = await history(app);
    expect(ids((await activity(app, ana, { category: "none" })).items)).toEqual([coffee.id]);
  });

  it("answers an empty page for a category that doesn't exist", async () => {
    const { app } = createTestApp();
    const { ana } = await history(app);
    expect(await activity(app, ana, { category: "deleted-meanwhile" })).toEqual({ items: [], nextCursor: null });
  });

  it("pages through a filtered history without repeats or gaps", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    const created: string[] = [];
    for (let day = 1; day <= 7; day += 1) {
      created.push((await addExpense(app, ana, { categoryId: rent.id, date: `2026-10-0${day}` })).id);
      await addExpense(app, ana, { date: `2026-10-0${day}` });
    }
    const first = await activity(app, ana, { category: rent.id, limit: "3" });
    const second = await activity(app, ana, { category: rent.id, limit: "3", cursor: first.nextCursor ?? "" });
    const third = await activity(app, ana, { category: rent.id, limit: "3", cursor: second.nextCursor ?? "" });
    expect([...ids(first.items), ...ids(second.items), ...ids(third.items)]).toEqual(created.reverse());
    expect(third.nextCursor).toBeNull();
  });

  it("works for guests, and shows another household nothing", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    const expense = await addExpense(app, ana, { categoryId: rent.id });
    expect(ids((await activity(app, carla, { category: rent.id })).items)).toEqual([expense.id]);

    const outsider = await signIn(app, dani);
    await createHousehold(app, outsider, "Dani's flat");
    expect((await activity(app, outsider, { category: rent.id })).items).toEqual([]);
  });

  it("refuses someone without a household", async () => {
    const { app } = createTestApp();
    await homeWith(app);
    const outsider = await signIn(app, dani);
    const res = await request(app)
      .get("/api/household/activity")
      .query({ category: "none" })
      .set("Authorization", outsider.auth);
    expect(res.status).toBe(404);
  });

  it("never changes the balances", async () => {
    const { app } = createTestApp();
    const { ana, rent } = await history(app);
    const all = await request(app).get("/api/household/balances").set("Authorization", ana.auth);
    const filtered = await request(app)
      .get("/api/household/balances")
      .query({ category: rent.id })
      .set("Authorization", ana.auth);
    expect(filtered.status).toBe(200);
    expect(filtered.body).toEqual(all.body);
  });
});
