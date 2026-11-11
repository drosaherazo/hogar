import { activityPageSchema } from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHousehold } from "./householdHelpers";
import { addExpense, homeWith, homeWithGuest } from "./expenseHelpers";
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
