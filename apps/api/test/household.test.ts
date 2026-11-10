import { currentHouseholdSchema, householdResponseSchema } from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { addMember, createHousehold, householdRow } from "./householdHelpers";
import { bruno, carla, createTestApp, signIn } from "./testApp";

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
    const res = await request(app).post("/api/household").set("Authorization", ana.auth).send({ name: "  Casa Ana " });

    expect(res.status).toBe(201);
    const { household } = householdResponseSchema.parse(res.body);
    expect(household.name).toBe("Casa Ana");
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
    const res = await request(app).post("/api/household").set("Authorization", ana.auth).send({ name });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code } });
  });

  it("refuses a second household for someone who already has one", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const first = await createHousehold(app, ana);
    const res = await request(app).post("/api/household").set("Authorization", ana.auth).send({ name: "Otra" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "household.already_member" } });
    expect((await householdRow(first.id))?.memberships).toHaveLength(1);
  });

  it("refuses members and guests of another household too", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const household = await createHousehold(app, ana);
    const guest = await addMember(app, household.id, carla, "GUEST");
    const res = await request(app).post("/api/household").set("Authorization", guest.auth).send({ name: "Mío" });
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
