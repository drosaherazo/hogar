import { activityPageSchema, createdInvitationSchema } from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  addExpense,
  addSettlement,
  balancesOf,
  deleteExpense,
  homeWithGuest,
  postExpense,
  postSettlement,
} from "./expenseHelpers";
import { createTestApp, type SignedIn } from "./testApp";

type App = ReturnType<typeof createTestApp>["app"];

const leave = (app: App, who: SignedIn) => request(app).post("/api/household/leave").set("Authorization", who.auth);

/** Ana, Bruno and Carla; Carla shares a €10.00 dinner with Ana (she owes €5.00), then leaves. */
async function carlaLeavesOwing(app: App) {
  const home = await homeWithGuest(app);
  const { ana, carla } = home;
  const dinner = await addExpense(app, ana, {
    description: "Dinner",
    amountCents: 1000,
    split: { method: "EQUAL", userIds: [ana.user.id, carla.user.id] },
  });
  expect((await leave(app, carla)).status).toBe(204);
  return { ...home, dinner };
}

describe("people who left or were removed", () => {
  it("keep counting in the balances, as former members, until they're square", async () => {
    const { app } = createTestApp();
    const { ana } = await carlaLeavesOwing(app);
    const view = await balancesOf(app, ana);
    expect(view.balances.map((entry) => [entry.person.name, entry.balanceCents, entry.person.former])).toEqual([
      ["Ana García", 500, false],
      ["Bruno Díaz", 0, false],
      ["Carla Ruiz", -500, true],
    ]);
    expect(view.suggestions).toEqual([
      {
        from: expect.objectContaining({ name: "Carla Ruiz", former: true }),
        to: expect.objectContaining({ name: "Ana García" }),
        amountCents: 500,
      },
    ]);
  });

  it("can settle up with the household after leaving", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await carlaLeavesOwing(app);
    const payment = await addSettlement(app, ana, {
      fromUserId: carla.user.id,
      toUserId: ana.user.id,
      amountCents: 500,
    });
    expect(payment.from).toEqual(expect.objectContaining({ userId: carla.user.id, former: true }));

    // Square again, Carla no longer appears in the balances.
    const view = await balancesOf(app, ana);
    expect(view.balances.map((entry) => entry.person.name)).toEqual(["Ana García", "Bruno Díaz"]);
    expect(view.suggestions).toEqual([]);
  });

  it("can't be added to new expenses", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await carlaLeavesOwing(app);
    for (const input of [
      { paidById: carla.user.id },
      { split: { method: "EQUAL" as const, userIds: [ana.user.id, carla.user.id] } },
    ]) {
      const res = await postExpense(app, ana, input);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: { code: "expense.person.not_member" } });
    }
  });

  it("lose access to the household's money", async () => {
    const { app } = createTestApp();
    const { carla, dinner } = await carlaLeavesOwing(app);
    for (const path of ["/api/household/activity", "/api/household/balances", `/api/household/expenses/${dinner.id}`]) {
      const res = await request(app).get(path).set("Authorization", carla.auth);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: "household.not_member" } });
    }
  });

  it("get their history and balance back when they rejoin", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await carlaLeavesOwing(app);
    const invited = await request(app)
      .post("/api/household/invitations")
      .set("Authorization", ana.auth)
      .send({ role: "GUEST" });
    const { token } = createdInvitationSchema.parse(invited.body);
    expect(
      (await request(app).post("/api/invitations/accept").set("Authorization", carla.auth).send({ token })).status,
    ).toBe(200);

    const view = await balancesOf(app, carla);
    expect(view.myBalanceCents).toBe(-500);
    expect(view.balances.find((entry) => entry.person.userId === carla.user.id)?.person.former).toBe(false);
  });

  it("show up as former members in the history", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    const bread = await addExpense(app, ana, {
      description: "Bread",
      paidById: carla.user.id,
      amountCents: 400,
      split: { method: "EQUAL", userIds: [ana.user.id, carla.user.id] },
    });
    await leave(app, carla);

    const history = activityPageSchema.parse(
      (await request(app).get("/api/household/activity").set("Authorization", ana.auth)).body,
    );
    const item = history.items.find((entry) => entry.id === bread.id);
    expect(item?.kind === "expense" && item.paidBy).toEqual(
      expect.objectContaining({ userId: carla.user.id, name: "Carla Ruiz", former: true }),
    );
  });

  it("aren't part of the history through deleted records alone", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    const dinner = await addExpense(app, ana, {
      amountCents: 1000,
      split: { method: "EQUAL", userIds: [ana.user.id, carla.user.id] },
    });
    expect((await deleteExpense(app, ana, dinner.id, 1)).status).toBe(204);
    await leave(app, carla);

    const res = await postSettlement(app, ana, { fromUserId: carla.user.id, toUserId: ana.user.id });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "settlement.person.not_found" } });
  });
});
