import { describe, expect, it } from "vitest";
import {
  addExpense,
  addSettlement,
  homeWith,
  inputOf,
  postExpense,
  postSettlement,
  putExpense,
  putSettlement,
  TODAY,
} from "./expenseHelpers";
import { request } from "./request";
import { createTestApp, db } from "./testApp";

/**
 * Expenses and payments are saved only in the currency the person saw (ADR 0011): if the
 * household's currency changed while a form was open, the save is refused.
 */
describe("money in the currency the person saw", () => {
  const mismatch = { error: { code: "money.currency.mismatch" } };

  it("records an expense and a payment sent in the household's currency", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app, { currency: "COP" });
    expect((await postExpense(app, ana, { amountCents: 85_000, currency: "COP" })).status).toBe(201);
    const payment = await postSettlement(app, bruno, {
      fromUserId: bruno.user.id,
      toUserId: ana.user.id,
      currency: "COP",
    });
    expect(payment.status).toBe(201);
  });

  it("refuses a new expense in another currency, and saves nothing", async () => {
    const { app } = createTestApp();
    const { household, ana } = await homeWith(app, { currency: "COP" });
    const res = await postExpense(app, ana, { amountCents: 4280, currency: "EUR" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(mismatch);
    expect(await db.expense.count({ where: { householdId: household.id } })).toBe(0);
  });

  it("refuses an edit in another currency, and keeps the expense as it was", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const expense = await addExpense(app, ana, { amountCents: 4280 });
    const res = await putExpense(app, ana, expense.id, {
      ...inputOf(expense),
      amountCents: 5000,
      currency: "USD",
      version: expense.version,
    });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(mismatch);
    expect((await db.expense.findUniqueOrThrow({ where: { id: expense.id } })).amountCents).toBe(4280);

    const right = await putExpense(app, ana, expense.id, {
      ...inputOf(expense),
      amountCents: 5000,
      currency: "EUR",
      version: expense.version,
    });
    expect(right.status).toBe(200);
  });

  it("refuses a new payment in another currency, and saves nothing", async () => {
    const { app } = createTestApp();
    const { household, ana, bruno } = await homeWith(app);
    const res = await postSettlement(app, bruno, { fromUserId: bruno.user.id, toUserId: ana.user.id, currency: "GBP" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(mismatch);
    expect(await db.settlement.count({ where: { householdId: household.id } })).toBe(0);
  });

  it("refuses a payment edit in another currency, and keeps the payment as it was", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const payment = await addSettlement(app, bruno, { fromUserId: bruno.user.id, toUserId: ana.user.id });
    const body = { fromUserId: bruno.user.id, toUserId: ana.user.id, amountCents: 2500, date: TODAY };

    const res = await putSettlement(app, bruno, payment.id, { ...body, currency: "COP", version: payment.version });
    expect(res.status).toBe(409);
    expect(res.body).toEqual(mismatch);
    expect((await db.settlement.findUniqueOrThrow({ where: { id: payment.id } })).amountCents).toBe(1000);

    const right = await putSettlement(app, bruno, payment.id, { ...body, currency: "EUR", version: payment.version });
    expect(right.status).toBe(200);
  });

  it.each([
    ["an expense", "/api/household/expenses"],
    ["a payment", "/api/household/settlements"],
  ] as const)("rejects %s sent without a currency as invalid", async (_, path) => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const body =
      path === "/api/household/expenses"
        ? {
            description: "Groceries",
            amountCents: 4280,
            paidById: ana.user.id,
            date: TODAY,
            split: { method: "EQUAL", userIds: [ana.user.id, bruno.user.id] },
          }
        : { fromUserId: bruno.user.id, toUserId: ana.user.id, amountCents: 1000, date: TODAY };
    const res = await request(app).post(path).set("Authorization", ana.auth).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "money.currency.invalid" } });
  });

  it.each([
    ["an expense edit", "expense"],
    ["a payment edit", "payment"],
  ] as const)("rejects %s sent without a currency as invalid", async (_, kind) => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    let path: string;
    let body: object;
    if (kind === "expense") {
      const expense = await addExpense(app, ana);
      path = `/api/household/expenses/${expense.id}`;
      // `inputOf` leaves the currency out; only the helpers fill it in.
      body = { ...inputOf(expense), version: expense.version };
    } else {
      const payment = await addSettlement(app, bruno, { fromUserId: bruno.user.id, toUserId: ana.user.id });
      path = `/api/household/settlements/${payment.id}`;
      body = {
        fromUserId: bruno.user.id,
        toUserId: ana.user.id,
        amountCents: 1000,
        date: TODAY,
        version: payment.version,
      };
    }
    const res = await request(app).put(path).set("Authorization", bruno.auth).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "money.currency.invalid" } });
  });
});
