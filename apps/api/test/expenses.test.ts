import { expenseResponseSchema } from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHousehold } from "./householdHelpers";
import {
  addExpense,
  balanceByUser,
  balancesOf,
  homeWith,
  homeWithGuest,
  postExpense,
  sharesByUser,
  TODAY,
} from "./expenseHelpers";
import { createTestApp, dani, db, signIn } from "./testApp";

describe("POST /api/household/expenses", () => {
  it("records an expense with the household's split", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);

    const res = await postExpense(app, ana, { amountCents: 4280 });
    expect(res.status).toBe(201);
    const { expense } = expenseResponseSchema.parse(res.body);
    expect(expense).toEqual(
      expect.objectContaining({
        description: "Groceries",
        amountCents: 4280,
        date: TODAY,
        version: 1,
        editedBy: null,
        editedAt: null,
      }),
    );
    expect(expense.paidBy).toEqual(expect.objectContaining({ userId: ana.user.id, name: "Ana García", former: false }));
    expect(expense.createdBy.userId).toBe(ana.user.id);
    expect(expense.split.method).toBe("WEIGHTS");
    expect(expense.split.shares.map((share) => [share.person.name, share.amountCents])).toEqual([
      ["Ana García", 3210],
      ["Bruno Díaz", 1070],
    ]);
    expect(sharesByUser(expense)).toEqual({ [ana.user.id]: 3210, [bruno.user.id]: 1070 });
  });

  it("gives the leftover cent to whoever joined first", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const expense = await addExpense(app, bruno, { amountCents: 1001 });
    expect(sharesByUser(expense)).toEqual({ [ana.user.id]: 751, [bruno.user.id]: 250 });
  });

  it("lets members record expenses, not only admins", async () => {
    const { app } = createTestApp();
    const { bruno } = await homeWith(app);
    expect((await postExpense(app, bruno, {})).status).toBe(201);
  });

  it("stores no share for people whose weight is 0", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWithGuest(app);
    const expense = await addExpense(app, ana, { amountCents: 4000 });
    expect(sharesByUser(expense)).toEqual({ [ana.user.id]: 3000, [bruno.user.id]: 1000 });
    expect(await db.expenseShare.count()).toBe(2);
  });

  it.each([
    ["an empty description", { description: "" }, "expense.description.required"],
    ["a description of only spaces", { description: "   " }, "expense.description.required"],
    ["a description over 100 characters", { description: "a".repeat(101) }, "expense.description.too_long"],
    ["an amount of zero", { amountCents: 0 }, "money.amount.invalid"],
    ["a negative amount", { amountCents: -1 }, "money.amount.invalid"],
    ["a fraction of a cent", { amountCents: 1.5 }, "money.amount.invalid"],
    ["more than €100,000.00", { amountCents: 10_000_001 }, "money.amount.invalid"],
    ["a date that doesn't exist", { date: "2026-13-01" }, "money.date.invalid"],
  ])("refuses %s", async (_, input, code) => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const res = await postExpense(app, ana, input);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code } });
    expect(await db.expense.count()).toBe(0);
  });

  it("refuses dates that haven't happened yet, allowing one day for time zones", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    // The test clock is 2026-10-26 10:00 UTC; somewhere it is already the 27th.
    expect((await postExpense(app, ana, { date: "2026-10-27" })).status).toBe(201);
    const future = await postExpense(app, ana, { date: "2026-10-28" });
    expect(future.status).toBe(400);
    expect(future.body).toEqual({ error: { code: "money.date.future" } });
  });

  it("refuses a payer who isn't a member of the household", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const outsider = await signIn(app, dani);
    for (const paidById of [outsider.user.id, "nobody"]) {
      const res = await postExpense(app, ana, { paidById });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: { code: "expense.person.not_member" } });
    }
  });

  it("asks for another way to split when nobody has a weight", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app, { weights: [0, 0] });
    const res = await postExpense(app, ana, {});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "expense.split.no_default" } });
  });

  it("refuses guests, with a message written for them", async () => {
    const { app } = createTestApp();
    const { carla: guest } = await homeWithGuest(app);
    const res = await postExpense(app, guest, {});
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.read_only" } });
  });

  it("refuses someone without a household", async () => {
    const { app } = createTestApp();
    await homeWith(app);
    const outsider = await signIn(app, dani);
    const res = await postExpense(app, outsider, {});
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "household.not_member" } });
  });

  it("requires a signed-in user", async () => {
    const { app } = createTestApp();
    const res = await request(app).post("/api/household/expenses").send({});
    expect(res.status).toBe(401);
  });
});

describe("other ways to split", () => {
  it("splits equally among the chosen people, leftover cents to whoever joined first", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    // The order people are chosen in doesn't matter: member order decides the leftover cent.
    const expense = await addExpense(app, ana, {
      amountCents: 1000,
      split: { method: "EQUAL", userIds: [carla.user.id, ana.user.id, bruno.user.id] },
    });
    expect(expense.split.method).toBe("EQUAL");
    expect(expense.split.shares.map((share) => [share.person.name, share.amountCents])).toEqual([
      ["Ana García", 334],
      ["Bruno Díaz", 333],
      ["Carla Ruiz", 333],
    ]);
  });

  it("keeps everyone chosen, even with a share of €0.00", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    const expense = await addExpense(app, ana, {
      amountCents: 2,
      split: { method: "EQUAL", userIds: [ana.user.id, bruno.user.id, carla.user.id] },
    });
    expect(sharesByUser(expense)).toEqual({ [ana.user.id]: 1, [bruno.user.id]: 1, [carla.user.id]: 0 });
    expect(await db.expenseShare.count()).toBe(3);
  });

  it("lets guests and people whose weight is 0 share an expense", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app, { weights: [0, 1] });
    const expense = await addExpense(app, ana, {
      amountCents: 1000,
      split: { method: "EQUAL", userIds: [ana.user.id, carla.user.id] },
    });
    expect(sharesByUser(expense)).toEqual({ [ana.user.id]: 500, [carla.user.id]: 500 });
  });

  it("takes exact amounts as entered, leaving out people given €0.00", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    const expense = await addExpense(app, bruno, {
      amountCents: 5000,
      split: {
        method: "EXACT",
        shares: [
          { userId: bruno.user.id, amountCents: 3000 },
          { userId: ana.user.id, amountCents: 2000 },
          { userId: carla.user.id, amountCents: 0 },
        ],
      },
    });
    expect(expense.split.method).toBe("EXACT");
    expect(expense.split.shares.map((share) => [share.person.name, share.amountCents])).toEqual([
      ["Ana García", 2000],
      ["Bruno Díaz", 3000],
    ]);
  });

  it("refuses exact amounts that don't add up to the total", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const res = await postExpense(app, bruno, {
      amountCents: 5000,
      split: {
        method: "EXACT",
        shares: [
          { userId: bruno.user.id, amountCents: 3000 },
          { userId: ana.user.id, amountCents: 1500 },
        ],
      },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "expense.split.mismatch" } });
  });

  it("lets the payer leave themselves out, so the whole amount is owed to them", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const expense = await addExpense(app, ana, { split: { method: "EQUAL", userIds: [bruno.user.id] } });
    expect(sharesByUser(expense)).toEqual({ [bruno.user.id]: 4280 });
    expect(balanceByUser(await balancesOf(app, ana))).toEqual({ [ana.user.id]: 4280, [bruno.user.id]: -4280 });
  });

  it("refuses the same person twice", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const res = await postExpense(app, ana, { split: { method: "EQUAL", userIds: [ana.user.id, ana.user.id] } });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "expense.split.invalid" } });
  });

  it("refuses people who aren't members of the household", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const outsider = await signIn(app, dani);
    const equal = await postExpense(app, ana, { split: { method: "EQUAL", userIds: [ana.user.id, outsider.user.id] } });
    expect(equal.status).toBe(400);
    expect(equal.body).toEqual({ error: { code: "expense.person.not_member" } });
    const exact = await postExpense(app, ana, {
      split: { method: "EXACT", shares: [{ userId: outsider.user.id, amountCents: 4280 }] },
    });
    expect(exact.body).toEqual({ error: { code: "expense.person.not_member" } });
  });
});

describe("GET /api/household/expenses/:id", () => {
  it("shows an expense to everyone in the household, guests included", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    const expense = await addExpense(app, ana);
    const res = await request(app).get(`/api/household/expenses/${expense.id}`).set("Authorization", carla.auth);
    expect(res.status).toBe(200);
    expect(expenseResponseSchema.parse(res.body).expense).toEqual(expense);
  });

  it("doesn't reveal another household's expenses", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const expense = await addExpense(app, ana);
    const outsider = await signIn(app, dani);
    await createHousehold(app, outsider, "Piso Dani");
    const res = await request(app).get(`/api/household/expenses/${expense.id}`).set("Authorization", outsider.auth);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "expense.not_found" } });
  });

  it("keeps the shares it was saved with when the weights change later", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const expense = await addExpense(app, ana, { amountCents: 4280 });

    const split = await request(app)
      .put("/api/household/split")
      .set("Authorization", ana.auth)
      .send({
        weights: [
          { membershipId: ana.membershipId, weight: 1 },
          { membershipId: bruno.membershipId, weight: 1 },
        ],
      });
    expect(split.status).toBe(200);

    const res = await request(app).get(`/api/household/expenses/${expense.id}`).set("Authorization", bruno.auth);
    expect(sharesByUser(expenseResponseSchema.parse(res.body).expense)).toEqual({
      [ana.user.id]: 3210,
      [bruno.user.id]: 1070,
    });
  });
});
