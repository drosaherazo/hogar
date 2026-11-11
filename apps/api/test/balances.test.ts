import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHousehold } from "./householdHelpers";
import { addExpense, balanceByUser, balancesOf, homeWith, homeWithGuest } from "./expenseHelpers";
import { createTestApp, dani, db, signIn } from "./testApp";

describe("GET /api/household/balances", () => {
  it("adds up to zero and shows everyone the same figures", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    // €42.80 paid by Ana (€32.10 / €10.70) and €4.00 paid by Bruno (€3.00 / €1.00).
    await addExpense(app, ana, { amountCents: 4280 });
    await addExpense(app, bruno, { amountCents: 400 });

    const forAna = await balancesOf(app, ana);
    const forBruno = await balancesOf(app, bruno);
    expect(forAna.balances.map((entry) => [entry.person.name, entry.balanceCents])).toEqual([
      ["Ana García", 770],
      ["Bruno Díaz", -770],
    ]);
    expect(forAna.balances.reduce((total, entry) => total + entry.balanceCents, 0)).toBe(0);
    expect(forBruno.balances).toEqual(forAna.balances);
    expect(forAna.suggestions).toEqual([
      {
        from: expect.objectContaining({ userId: bruno.user.id }),
        to: expect.objectContaining({ userId: ana.user.id }),
        amountCents: 770,
      },
    ]);
    expect(forBruno.suggestions).toEqual(forAna.suggestions);
    expect(forAna.myBalanceCents).toBe(770);
    expect(forBruno.myBalanceCents).toBe(-770);
  });

  it("collapses a chain of debts into one payment (the spec's example)", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    // Ana pays €20.00 that only Bruno shares; then Bruno pays €20.00 that only Carla shares.
    await db.membership.update({ where: { id: ana.membershipId }, data: { weight: 0 } });
    await addExpense(app, ana, { amountCents: 2000 });
    await db.membership.update({ where: { id: bruno.membershipId }, data: { weight: 0 } });
    await db.membership.update({ where: { id: carla.membershipId }, data: { weight: 1 } });
    await addExpense(app, bruno, { amountCents: 2000 });

    const view = await balancesOf(app, ana);
    expect(balanceByUser(view)).toEqual({ [ana.user.id]: 2000, [bruno.user.id]: 0, [carla.user.id]: -2000 });
    expect(view.suggestions).toEqual([
      {
        from: expect.objectContaining({ name: "Carla Ruiz" }),
        to: expect.objectContaining({ name: "Ana García" }),
        amountCents: 2000,
      },
    ]);
  });

  it("lists every member in member order, at zero when they have no records", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    const view = await balancesOf(app, ana);
    expect(view.balances.map((entry) => [entry.person.name, entry.balanceCents, entry.person.former])).toEqual([
      ["Ana García", 0, false],
      ["Bruno Díaz", 0, false],
      ["Carla Ruiz", 0, false],
    ]);
    expect(view.suggestions).toEqual([]);
    expect((await balancesOf(app, carla)).myBalanceCents).toBe(0);
  });

  it("lets guests see the balances", async () => {
    const { app } = createTestApp();
    const { ana, carla } = await homeWithGuest(app);
    await addExpense(app, ana);
    const res = await request(app).get("/api/household/balances").set("Authorization", carla.auth);
    expect(res.status).toBe(200);
  });

  it("keeps each household's money to itself", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    await addExpense(app, ana);
    const outsider = await signIn(app, dani);
    await createHousehold(app, outsider, "Piso Dani");
    const view = await balancesOf(app, outsider);
    expect(view.balances.map((entry) => [entry.person.userId, entry.balanceCents])).toEqual([[outsider.user.id, 0]]);
  });

  it("refuses someone without a household", async () => {
    const { app } = createTestApp();
    const outsider = await signIn(app, dani);
    const res = await request(app).get("/api/household/balances").set("Authorization", outsider.auth);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "household.not_member" } });
  });
});
