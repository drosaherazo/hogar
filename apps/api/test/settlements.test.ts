import { activityPageSchema, settlementResponseSchema } from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHousehold } from "./householdHelpers";
import {
  addExpense,
  addSettlement,
  balanceByUser,
  balancesOf,
  deleteSettlement,
  homeWith,
  homeWithGuest,
  postSettlement,
  putSettlement,
  TODAY,
} from "./expenseHelpers";
import { createTestApp, dani, db, signIn } from "./testApp";

describe("POST /api/household/settlements", () => {
  it("records a payment and settles the balance", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    await addExpense(app, ana, { amountCents: 4280 }); // Bruno owes €10.70

    const res = await postSettlement(app, bruno, {
      fromUserId: bruno.user.id,
      toUserId: ana.user.id,
      amountCents: 1070,
    });
    expect(res.status).toBe(201);
    const { settlement } = settlementResponseSchema.parse(res.body);
    expect(settlement).toEqual(
      expect.objectContaining({ amountCents: 1070, date: TODAY, version: 1, editedBy: null, editedAt: null }),
    );
    expect(settlement.from).toEqual(
      expect.objectContaining({ userId: bruno.user.id, name: "Bruno Díaz", former: false }),
    );
    expect(settlement.to.userId).toBe(ana.user.id);
    expect(settlement.createdBy.userId).toBe(bruno.user.id);

    const view = await balancesOf(app, ana);
    expect(balanceByUser(view)).toEqual({ [ana.user.id]: 0, [bruno.user.id]: 0 });
    expect(view.suggestions).toEqual([]);
  });

  it("lets anyone who edits record a payment between two other people", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const res = await postSettlement(app, ana, { fromUserId: bruno.user.id, toUserId: ana.user.id });
    expect(res.status).toBe(201);
  });

  it("allows paying more than what's owed, which reverses the balance", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    await addExpense(app, ana, { amountCents: 4280 });
    await addSettlement(app, bruno, { fromUserId: bruno.user.id, toUserId: ana.user.id, amountCents: 1500 });
    expect(balanceByUser(await balancesOf(app, ana))).toEqual({ [ana.user.id]: -430, [bruno.user.id]: 430 });
  });

  it("refuses a payment to oneself", async () => {
    const { app } = createTestApp();
    const { bruno } = await homeWith(app);
    const res = await postSettlement(app, bruno, { fromUserId: bruno.user.id, toUserId: bruno.user.id });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "settlement.same_person" } });
  });

  it.each([
    ["an amount of zero", { amountCents: 0 }, "money.amount.invalid"],
    ["more than €100,000.00", { amountCents: 10_000_001 }, "money.amount.invalid"],
    ["a date that doesn't exist", { date: "2026-02-30" }, "money.date.invalid"],
    ["a date that hasn't happened yet", { date: "2026-10-28" }, "money.date.future"],
  ] as const)("refuses %s", async (_, input, code) => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const res = await postSettlement(app, bruno, { fromUserId: bruno.user.id, toUserId: ana.user.id, ...input });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code } });
    expect(await db.settlement.count()).toBe(0);
  });

  it("refuses people who aren't in the household or its history", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const outsider = await signIn(app, dani);
    for (const fromUserId of [outsider.user.id, "nobody"]) {
      const res = await postSettlement(app, ana, { fromUserId, toUserId: ana.user.id });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: { code: "settlement.person.not_found" } });
    }
  });

  it("refuses guests, with a message written for them", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    const res = await postSettlement(app, carla, { fromUserId: carla.user.id, toUserId: ana.user.id });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.read_only" } });
  });

  it("refuses someone without a household", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const outsider = await signIn(app, dani);
    const res = await postSettlement(app, outsider, { fromUserId: bruno.user.id, toUserId: ana.user.id });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "household.not_member" } });
  });
});

describe("GET /api/household/settlements/:id", () => {
  it("shows a payment to everyone in the household, guests included", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    const settlement = await addSettlement(app, ana, { fromUserId: bruno.user.id, toUserId: ana.user.id });
    const res = await request(app).get(`/api/household/settlements/${settlement.id}`).set("Authorization", carla.auth);
    expect(res.status).toBe(200);
    expect(settlementResponseSchema.parse(res.body).settlement).toEqual(settlement);
  });

  it("doesn't reveal another household's payments", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const settlement = await addSettlement(app, ana, { fromUserId: bruno.user.id, toUserId: ana.user.id });
    const outsider = await signIn(app, dani);
    await createHousehold(app, outsider, "Piso Dani");
    const res = await request(app)
      .get(`/api/household/settlements/${settlement.id}`)
      .set("Authorization", outsider.auth);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "settlement.not_found" } });
  });
});

describe("editing and deleting payments", () => {
  it("lets any editor change a payment, and says who changed it", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const payment = await addSettlement(app, bruno, {
      fromUserId: bruno.user.id,
      toUserId: ana.user.id,
      amountCents: 1000,
    });
    const res = await putSettlement(app, ana, payment.id, {
      fromUserId: bruno.user.id,
      toUserId: ana.user.id,
      amountCents: 500,
      date: TODAY,
      version: 1,
    });
    expect(res.status).toBe(200);
    const edited = settlementResponseSchema.parse(res.body).settlement;
    expect(edited).toEqual(expect.objectContaining({ amountCents: 500, version: 2 }));
    expect(edited.editedBy?.userId).toBe(ana.user.id);
    expect(balanceByUser(await balancesOf(app, ana))).toEqual({ [ana.user.id]: -500, [bruno.user.id]: 500 });
  });

  it("refuses a change based on an outdated version", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const payment = await addSettlement(app, bruno, { fromUserId: bruno.user.id, toUserId: ana.user.id });
    const body = { fromUserId: bruno.user.id, toUserId: ana.user.id, amountCents: 700, date: TODAY, version: 1 };
    expect((await putSettlement(app, ana, payment.id, body)).status).toBe(200);
    const stale = await putSettlement(app, bruno, payment.id, { ...body, amountCents: 800 });
    expect(stale.status).toBe(409);
    expect(stale.body).toEqual({ error: { code: "settlement.changed" } });
  });

  it("deletes a payment with its version, leaving a trace in the history", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const payment = await addSettlement(app, bruno, { fromUserId: bruno.user.id, toUserId: ana.user.id });

    expect((await deleteSettlement(app, ana, payment.id)).status).toBe(400);
    expect((await deleteSettlement(app, ana, payment.id, 1)).status).toBe(204);
    const gone = await request(app).get(`/api/household/settlements/${payment.id}`).set("Authorization", ana.auth);
    expect(gone.status).toBe(404);
    expect(gone.body).toEqual({ error: { code: "settlement.not_found" } });
    expect(balanceByUser(await balancesOf(app, ana))).toEqual({ [ana.user.id]: 0, [bruno.user.id]: 0 });

    const history = activityPageSchema.parse(
      (await request(app).get("/api/household/activity").set("Authorization", ana.auth)).body,
    );
    expect(history.items[0]).toEqual(
      expect.objectContaining({
        kind: "settlement",
        id: payment.id,
        deleted: expect.objectContaining({ by: expect.objectContaining({ userId: ana.user.id }) }),
      }),
    );
  });

  it("refuses guests, and people from other households", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    const payment = await addSettlement(app, bruno, { fromUserId: bruno.user.id, toUserId: ana.user.id });
    const body = { fromUserId: bruno.user.id, toUserId: ana.user.id, amountCents: 700, date: TODAY, version: 1 };
    expect((await putSettlement(app, carla, payment.id, body)).status).toBe(403);
    expect((await deleteSettlement(app, carla, payment.id, 1)).status).toBe(403);

    const outsider = await signIn(app, dani);
    await createHousehold(app, outsider, "Piso Dani");
    expect((await putSettlement(app, outsider, payment.id, body)).status).toBe(404);
    expect((await deleteSettlement(app, outsider, payment.id, 1)).status).toBe(404);
  });
});

describe("payments in the history", () => {
  it("appear alongside expenses, in date order", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const expense = await addExpense(app, ana, { date: "2026-10-24" });
    const settlement = await addSettlement(app, bruno, {
      fromUserId: bruno.user.id,
      toUserId: ana.user.id,
      amountCents: 1070,
      date: "2026-10-25",
    });

    const res = await request(app).get("/api/household/activity").set("Authorization", ana.auth);
    const { items } = activityPageSchema.parse(res.body);
    expect(items.map((item) => [item.kind, item.id])).toEqual([
      ["settlement", settlement.id],
      ["expense", expense.id],
    ]);
    expect(items[0]).toEqual({
      kind: "settlement",
      id: settlement.id,
      amountCents: 1070,
      date: "2026-10-25",
      from: expect.objectContaining({ name: "Bruno Díaz" }),
      to: expect.objectContaining({ name: "Ana García" }),
      deleted: null,
    });
  });
});
