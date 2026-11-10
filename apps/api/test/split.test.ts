import { householdResponseSchema } from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { addMember, createHousehold } from "./householdHelpers";
import { bruno, carla, createTestApp, dani, db, signIn } from "./testApp";

/** Ana (ADMIN) and Bruno (MEMBER), both with weight 1. */
async function setup() {
  const context = createTestApp();
  const ana = await signIn(context.app);
  const household = await createHousehold(context.app, ana);
  context.clock.advance(1000);
  const brunoMember = await addMember(context.app, household.id, bruno, "MEMBER");
  await db.household.update({ where: { id: household.id }, data: { membersChangedAt: context.clock.now() } });
  context.clock.advance(1000);
  return { ...context, ana, household, bruno: brunoMember };
}

const putSplit = (app: ReturnType<typeof createTestApp>["app"], auth: string, weights: unknown) =>
  request(app).put("/api/household/split").set("Authorization", auth).send({ weights });

describe("PUT /api/household/split", () => {
  it("saves the weights, shows the resulting shares and clears the review banner", async () => {
    const { app, ana, household, bruno: brunoMember } = await setup();
    const before = householdResponseSchema.parse(
      (await request(app).get("/api/household").set("Authorization", ana.auth)).body,
    ).household;
    expect(before.splitNeedsReview).toBe(true);
    expect(before.members.map((member) => member.shareBps)).toEqual([5000, 5000]);

    const res = await putSplit(app, ana.auth, [
      { membershipId: household.myMembershipId, weight: 3 },
      { membershipId: brunoMember.membershipId, weight: 1 },
    ]);
    expect(res.status).toBe(200);
    const after = householdResponseSchema.parse(res.body).household;
    expect(after.members.map((member) => [member.weight, member.shareBps])).toEqual([
      [3, 7500],
      [1, 2500],
    ]);
    expect(after.splitNeedsReview).toBe(false);
  });

  it("asks for a review again when someone joins after the split was saved", async () => {
    const { app, ana, household, bruno: brunoMember, clock } = await setup();
    await putSplit(app, ana.auth, [
      { membershipId: household.myMembershipId, weight: 1 },
      { membershipId: brunoMember.membershipId, weight: 1 },
    ]);
    clock.advance(1000);
    const invited = await request(app)
      .post("/api/household/invitations")
      .set("Authorization", ana.auth)
      .send({ role: "MEMBER" });
    await request(app)
      .post("/api/invitations/accept")
      .set("Authorization", (await signIn(app, carla)).auth)
      .send({ token: invited.body.token });

    const view = householdResponseSchema.parse(
      (await request(app).get("/api/household").set("Authorization", ana.auth)).body,
    ).household;
    expect(view.splitNeedsReview).toBe(true);
    expect(view.members.map((member) => member.shareBps)).toEqual([3334, 3333, 3333]);
  });

  it.each([
    ["above 100", 101],
    ["below 0", -1],
    ["not whole", 1.5],
    ["not a number", "3"],
  ])("refuses a weight %s", async (_, weight) => {
    const { app, ana, household, bruno: brunoMember } = await setup();
    const res = await putSplit(app, ana.auth, [
      { membershipId: household.myMembershipId, weight },
      { membershipId: brunoMember.membershipId, weight: 1 },
    ]);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "split.weight.invalid" } });
  });

  it("refuses a split where nobody pays", async () => {
    const { app, ana, household, bruno: brunoMember } = await setup();
    const res = await putSplit(app, ana.auth, [
      { membershipId: household.myMembershipId, weight: 0 },
      { membershipId: brunoMember.membershipId, weight: 0 },
    ]);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "split.all_zero" } });
  });

  it("refuses a split that doesn't list exactly the current members", async () => {
    const { app, ana, household, bruno: brunoMember } = await setup();
    const missing = await putSplit(app, ana.auth, [{ membershipId: household.myMembershipId, weight: 1 }]);
    expect(missing.status).toBe(409);
    expect(missing.body).toEqual({ error: { code: "split.members_changed" } });

    const daniSession = await signIn(app, dani);
    const other = await createHousehold(app, daniSession, "Piso Dani");
    const foreign = await putSplit(app, ana.auth, [
      { membershipId: household.myMembershipId, weight: 1 },
      { membershipId: brunoMember.membershipId, weight: 1 },
      { membershipId: other.myMembershipId, weight: 5 },
    ]);
    expect(foreign.status).toBe(409);
    expect((await db.membership.findUniqueOrThrow({ where: { id: other.myMembershipId } })).weight).toBe(1);
  });

  it.each(["MEMBER", "GUEST"] as const)("refuses a %s", async (role) => {
    const { app, household, bruno: brunoMember } = await setup();
    const other = await addMember(app, household.id, carla, role);
    const res = await putSplit(app, other.auth, [
      { membershipId: household.myMembershipId, weight: 1 },
      { membershipId: brunoMember.membershipId, weight: 9 },
      { membershipId: other.membershipId, weight: 0 },
    ]);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.forbidden" } });
  });

  it("refuses someone without a household", async () => {
    const { app } = await setup();
    const daniSession = await signIn(app, dani);
    const res = await putSplit(app, daniSession.auth, [{ membershipId: "x", weight: 1 }]);
    expect(res.status).toBe(404);
  });

  it("keeps weights in range even if someone writes to the database directly", async () => {
    const { household } = await setup();
    await expect(
      db.membership.update({ where: { id: household.myMembershipId }, data: { weight: 101 } }),
    ).rejects.toThrow();
  });
});
