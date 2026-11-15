import { currentHouseholdSchema, householdResponseSchema } from "@hogar/shared";
import { describe, expect, it } from "vitest";
import { request } from "./request";
import { addExpense, addSettlement, deleteExpense, homeWith } from "./expenseHelpers";
import { addMember, createHousehold, householdRow } from "./householdHelpers";
import { bruno, carla, createTestApp, db, signIn } from "./testApp";

describe("GET /api/household", () => {
  it("says the user has no household yet", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const res = await request(app).get("/api/household").set("Authorization", ana.auth);
    expect(res.status).toBe(200);
    expect(currentHouseholdSchema.parse(res.body)).toEqual({ household: null, removedFrom: null });
  });

  it("returns the household with its members in join order", async () => {
    const { app, clock } = createTestApp();
    const ana = await signIn(app);
    const created = await createHousehold(app, ana);
    clock.advance(1000);
    await addMember(app, created.id, bruno, "MEMBER");

    const res = await request(app).get("/api/household").set("Authorization", ana.auth);
    const { household } = householdResponseSchema.parse(res.body);
    expect(household.members.map((member) => member.name)).toEqual(["Ana García", "Bruno Díaz"]);
    expect(household.myRole).toBe("ADMIN");
  });

  it.each(["MEMBER", "GUEST"] as const)("shows a %s the household, its members and their roles", async (role) => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const created = await createHousehold(app, ana);
    const other = await addMember(app, created.id, bruno, role);

    const res = await request(app).get("/api/household").set("Authorization", other.auth);
    expect(res.status).toBe(200);
    const { household } = householdResponseSchema.parse(res.body);
    expect(household.myRole).toBe(role);
    expect(household.myMembershipId).toBe(other.membershipId);
    expect(household.members.map((member) => [member.name, member.role])).toEqual([
      ["Ana García", "ADMIN"],
      ["Bruno Díaz", role],
    ]);
    // The household view never carries invitations: only admins can list them.
    expect(res.body.household).not.toHaveProperty("invitations");
  });

  it("requires a signed-in user", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/api/household");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: "auth.token.invalid" } });
  });
});

describe("POST /api/household", () => {
  it("creates the household with the creator as its only admin, weight 1", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const res = await request(app)
      .post("/api/household")
      .set("Authorization", ana.auth)
      .send({ name: "  Casa Ana ", currency: "EUR" });

    expect(res.status).toBe(201);
    const { household } = householdResponseSchema.parse(res.body);
    expect(household.name).toBe("Casa Ana");
    expect(household.currency).toBe("EUR");
    expect(household.myRole).toBe("ADMIN");
    expect(household.splitNeedsReview).toBe(false);
    expect(household.members).toEqual([
      expect.objectContaining({ userId: ana.user.id, role: "ADMIN", weight: 1, shareBps: 10000 }),
    ]);
    expect(household.myMembershipId).toBe(household.members[0]?.id);
  });

  it.each([
    ["an empty name", "", "household.name.required"],
    ["a name of only spaces", "    ", "household.name.required"],
    ["a name over 50 characters", "a".repeat(51), "household.name.too_long"],
    ["a name that isn't text", 42, "request.invalid"],
  ])("refuses %s", async (_, name, code) => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const res = await request(app)
      .post("/api/household")
      .set("Authorization", ana.auth)
      .send({ name, currency: "EUR" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code } });
  });

  it("keeps the currency chosen, which every member then reads", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const created = await createHousehold(app, ana, "Casa Bogotá", "COP");
    expect(created.currency).toBe("COP");
    const brunoMember = await addMember(app, created.id, bruno, "MEMBER");

    const res = await request(app).get("/api/household").set("Authorization", brunoMember.auth);
    expect(householdResponseSchema.parse(res.body).household.currency).toBe("COP");
  });

  it.each(["JPY", "KWD", "INR", "XOF"] as const)(
    "creates a household in %s, any currency in force somewhere",
    async (code) => {
      const { app } = createTestApp();
      const ana = await signIn(app);
      const created = await createHousehold(app, ana, "Casa", code);
      expect(created.currency).toBe(code);
    },
  );

  it.each([
    ["without a currency", {}],
    ["with a currency outside the list", { currency: "XAU" }],
    ["with a currency that isn't text", { currency: 978 }],
  ])("refuses a household %s", async (_, extra) => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const res = await request(app)
      .post("/api/household")
      .set("Authorization", ana.auth)
      .send({ name: "Casa", ...extra });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "money.currency.invalid" } });
    expect(await db.household.count()).toBe(0);
  });

  it("refuses a second household for someone who already has one", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const first = await createHousehold(app, ana);
    const res = await request(app)
      .post("/api/household")
      .set("Authorization", ana.auth)
      .send({ name: "Otra", currency: "EUR" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "household.already_member" } });
    expect((await householdRow(first.id))?.memberships).toHaveLength(1);
  });

  it("refuses members and guests of another household too", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const household = await createHousehold(app, ana);
    const guest = await addMember(app, household.id, carla, "GUEST");
    const res = await request(app)
      .post("/api/household")
      .set("Authorization", guest.auth)
      .send({ name: "Mío", currency: "EUR" });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/household", () => {
  it("lets an admin rename the household", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    await createHousehold(app, ana);
    const res = await request(app).patch("/api/household").set("Authorization", ana.auth).send({ name: "Casa nueva" });
    expect(res.status).toBe(200);
    expect(householdResponseSchema.parse(res.body).household.name).toBe("Casa nueva");
  });

  it.each(["MEMBER", "GUEST"] as const)("refuses a %s", async (role) => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const household = await createHousehold(app, ana);
    const other = await addMember(app, household.id, bruno, role);
    const res = await request(app).patch("/api/household").set("Authorization", other.auth).send({ name: "Mía" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.forbidden" } });
    expect((await householdRow(household.id))?.name).toBe("Casa Ana");
  });

  it("refuses someone without a household", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const res = await request(app).patch("/api/household").set("Authorization", ana.auth).send({ name: "Mía" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "household.not_member" } });
  });

  it("validates the new name", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    await createHousehold(app, ana);
    const res = await request(app).patch("/api/household").set("Authorization", ana.auth).send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "household.name.required" } });
  });
});

describe("PATCH /api/household with a currency", () => {
  const changeCurrency = (app: ReturnType<typeof createTestApp>["app"], auth: string, body: object) =>
    request(app).patch("/api/household").set("Authorization", auth).send(body);

  it("lets an admin change the currency while the household has no money, which everyone then reads", async () => {
    const { app } = createTestApp();
    const home = await homeWith(app);

    const res = await changeCurrency(app, home.ana.auth, { currency: "COP" });
    expect(res.status).toBe(200);
    const household = householdResponseSchema.parse(res.body).household;
    expect(household).toMatchObject({ currency: "COP", currencyLocked: false, name: "Casa Ana" });

    const seen = await request(app).get("/api/household").set("Authorization", home.bruno.auth);
    expect(householdResponseSchema.parse(seen.body).household.currency).toBe("COP");
  });

  it("changes to a currency with three decimals", async () => {
    const { app } = createTestApp();
    const home = await homeWith(app);
    const res = await changeCurrency(app, home.ana.auth, { currency: "KWD" });
    expect(res.status).toBe(200);
    expect(householdResponseSchema.parse(res.body).household.currency).toBe("KWD");
  });

  it("renames and changes the currency in one request", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    await createHousehold(app, ana);
    const res = await changeCurrency(app, ana.auth, { name: "Casa Bogotá", currency: "COP" });
    expect(householdResponseSchema.parse(res.body).household).toMatchObject({ name: "Casa Bogotá", currency: "COP" });
  });

  it("says the currency can change in a new household", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    expect((await createHousehold(app, ana)).currencyLocked).toBe(false);
  });

  it.each([
    [
      "an expense",
      async (app: ReturnType<typeof createTestApp>["app"], home: Awaited<ReturnType<typeof homeWith>>) => {
        await addExpense(app, home.ana);
      },
    ],
    [
      "a payment",
      async (app: ReturnType<typeof createTestApp>["app"], home: Awaited<ReturnType<typeof homeWith>>) => {
        await addSettlement(app, home.bruno, { fromUserId: home.bruno.user.id, toUserId: home.ana.user.id });
      },
    ],
    [
      "a deleted expense",
      async (app: ReturnType<typeof createTestApp>["app"], home: Awaited<ReturnType<typeof homeWith>>) => {
        const expense = await addExpense(app, home.ana);
        expect((await deleteExpense(app, home.ana, expense.id, expense.version)).status).toBe(204);
      },
    ],
  ])("fixes the currency once the household has %s", async (_, record) => {
    const { app } = createTestApp();
    const home = await homeWith(app);
    await record(app, home);

    const seen = await request(app).get("/api/household").set("Authorization", home.ana.auth);
    expect(householdResponseSchema.parse(seen.body).household.currencyLocked).toBe(true);

    const res = await changeCurrency(app, home.ana.auth, { name: "Casa nueva", currency: "COP" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "household.currency.locked" } });
    // Nothing changes, not even the name sent with it.
    expect(await householdRow(home.household.id)).toMatchObject({ currency: "EUR", name: "Casa Ana" });
  });

  it("still renames a household whose currency is fixed, when the currency sent is the same", async () => {
    const { app } = createTestApp();
    const home = await homeWith(app);
    await addExpense(app, home.ana);
    const res = await changeCurrency(app, home.ana.auth, { name: "Casa nueva", currency: "EUR" });
    expect(res.status).toBe(200);
    expect(householdResponseSchema.parse(res.body).household).toMatchObject({ name: "Casa nueva", currency: "EUR" });
  });

  it.each(["MEMBER", "GUEST"] as const)("refuses a %s", async (role) => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const household = await createHousehold(app, ana);
    const other = await addMember(app, household.id, bruno, role);
    const res = await changeCurrency(app, other.auth, { currency: "COP" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.forbidden" } });
    expect((await householdRow(household.id))?.currency).toBe("EUR");
  });

  it("only ever changes the caller's own household", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const anas = await createHousehold(app, ana);
    const carlaSession = await signIn(app, carla);
    await createHousehold(app, carlaSession, "Piso Carla");

    const res = await changeCurrency(app, carlaSession.auth, { currency: "COP" });
    expect(res.status).toBe(200);
    expect((await householdRow(anas.id))?.currency).toBe("EUR");
  });

  it("refuses someone without a household", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const res = await changeCurrency(app, ana.auth, { currency: "COP" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "household.not_member" } });
  });

  it.each([
    ["a currency outside the list", { currency: "XAU" }, "money.currency.invalid"],
    ["nothing to change", {}, "request.invalid"],
  ])("refuses %s", async (_, body, code) => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const household = await createHousehold(app, ana);
    const res = await changeCurrency(app, ana.auth, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code } });
    expect((await householdRow(household.id))?.currency).toBe("EUR");
  });
});
