import { createdInvitationSchema, currentHouseholdSchema, householdResponseSchema } from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { addExpense, addSettlement } from "./expenseHelpers";
import { addMember, createHousehold, householdRow } from "./householdHelpers";
import { bruno, carla, createTestApp, dani, db, signIn, type SignedIn } from "./testApp";

/** Ana (ADMIN) with Bruno (MEMBER) and Carla (GUEST). */
async function setup() {
  const context = createTestApp();
  const ana = await signIn(context.app);
  const household = await createHousehold(context.app, ana);
  context.clock.advance(1000);
  const brunoMember = await addMember(context.app, household.id, bruno, "MEMBER");
  const carlaGuest = await addMember(context.app, household.id, carla, "GUEST");
  return { ...context, ana, household, bruno: brunoMember, carla: carlaGuest };
}

describe("PATCH /api/household/members/:id", () => {
  it("lets an admin change anyone's role without touching their weight", async () => {
    const { app, ana, carla } = await setup();
    const res = await request(app)
      .patch(`/api/household/members/${carla.membershipId}`)
      .set("Authorization", ana.auth)
      .send({ role: "ADMIN" });
    expect(res.status).toBe(200);
    const carlaView = householdResponseSchema.parse(res.body).household.members.find((m) => m.name === "Carla Ruiz");
    expect(carlaView).toEqual(expect.objectContaining({ role: "ADMIN", weight: 0 }));
  });

  it("applies the new role right away", async () => {
    const { app, ana, bruno } = await setup();
    await request(app)
      .patch(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth)
      .send({ role: "ADMIN" });
    const rename = await request(app)
      .patch("/api/household")
      .set("Authorization", bruno.auth)
      .send({ name: "Nuestra casa" });
    expect(rename.status).toBe(200);
  });

  it("refuses to demote the last admin, even themselves", async () => {
    const { app, ana, household } = await setup();
    const res = await request(app)
      .patch(`/api/household/members/${household.myMembershipId}`)
      .set("Authorization", ana.auth)
      .send({ role: "MEMBER" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "household.last_admin" } });
  });

  it("lets an admin step down when another admin remains", async () => {
    const { app, ana, bruno, household } = await setup();
    await request(app)
      .patch(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth)
      .send({ role: "ADMIN" });
    const res = await request(app)
      .patch(`/api/household/members/${household.myMembershipId}`)
      .set("Authorization", ana.auth)
      .send({ role: "MEMBER" });
    expect(res.status).toBe(200);
    expect(householdResponseSchema.parse(res.body).household.myRole).toBe("MEMBER");
  });

  it.each(["bruno", "carla"] as const)("refuses %s, who isn't an admin", async (who) => {
    const context = await setup();
    const res = await request(context.app)
      .patch(`/api/household/members/${context.household.myMembershipId}`)
      .set("Authorization", context[who].auth)
      .send({ role: "GUEST" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.forbidden" } });
  });

  it("can't reach members of another household", async () => {
    const { app, bruno: brunoMember } = await setup();
    const daniSession = await signIn(app, dani);
    await createHousehold(app, daniSession, "Piso Dani");
    const res = await request(app)
      .patch(`/api/household/members/${brunoMember.membershipId}`)
      .set("Authorization", daniSession.auth)
      .send({ role: "GUEST" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "household.member_not_found" } });
  });

  it("refuses someone without a household", async () => {
    const { app, bruno: brunoMember } = await setup();
    const daniSession = await signIn(app, dani);
    const responses = await Promise.all([
      request(app)
        .patch(`/api/household/members/${brunoMember.membershipId}`)
        .set("Authorization", daniSession.auth)
        .send({ role: "GUEST" }),
      request(app).delete(`/api/household/members/${brunoMember.membershipId}`).set("Authorization", daniSession.auth),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: "household.not_member" } });
    }
    expect(await db.membership.findUnique({ where: { id: brunoMember.membershipId } })).toEqual(
      expect.objectContaining({ role: "MEMBER" }),
    );
  });

  it("validates the role", async () => {
    const { app, ana, bruno } = await setup();
    const res = await request(app)
      .patch(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth)
      .send({ role: "OWNER" });
    expect(res.status).toBe(400);
  });

  it("never ends without an admin when two admins demote each other at the same time", async () => {
    const { app, ana, bruno, household } = await setup();
    await request(app)
      .patch(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth)
      .send({ role: "ADMIN" });

    const results = await Promise.all([
      request(app)
        .patch(`/api/household/members/${bruno.membershipId}`)
        .set("Authorization", ana.auth)
        .send({ role: "MEMBER" }),
      request(app)
        .patch(`/api/household/members/${household.myMembershipId}`)
        .set("Authorization", bruno.auth)
        .send({ role: "MEMBER" }),
    ]);

    const admins = (await householdRow(household.id))?.memberships.filter((m) => m.role === "ADMIN") ?? [];
    expect(admins).toHaveLength(1);
    // Whoever loses the race is refused: either they're no longer an admin (403)
    // or their change would leave no admin (409). Never both succeed.
    const [first, second] = results.map((res) => res.status).sort();
    expect(first).toBe(200);
    expect([403, 409]).toContain(second);
  });

  it("re-checks the actor's role under the lock, so a just-demoted admin can't act", async () => {
    const { app, ana, bruno, carla } = await setup();
    await request(app)
      .patch(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth)
      .send({ role: "ADMIN" });

    // Ana demotes Bruno while Bruno, still an admin when his request started, removes Carla.
    const [demote, remove] = await Promise.all([
      request(app)
        .patch(`/api/household/members/${bruno.membershipId}`)
        .set("Authorization", ana.auth)
        .send({ role: "MEMBER" }),
      request(app).delete(`/api/household/members/${carla.membershipId}`).set("Authorization", bruno.auth),
    ]);
    expect(demote.status).toBe(200);
    // Either Bruno's removal ran first (while he was admin) or it was refused: never after his demotion.
    if (remove.status !== 200) expect(remove.status).toBe(403);
  });
});

describe("DELETE /api/household/members/:id", () => {
  it("removes a member, who then sees a one-time note naming the household", async () => {
    const { app, ana, bruno, household, clock } = await setup();
    clock.advance(1000);

    const res = await request(app)
      .delete(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth);
    expect(res.status).toBe(200);
    expect(householdResponseSchema.parse(res.body).household.members.map((m) => m.name)).not.toContain("Bruno Díaz");

    const brunoView = currentHouseholdSchema.parse(
      (await request(app).get("/api/household").set("Authorization", bruno.auth)).body,
    );
    expect(brunoView).toEqual({ household: null, removedFrom: "Casa Ana" });
    const row = await householdRow(household.id);
    expect(row?.membersChangedAt.getTime()).toBe(clock.current.getTime());

    const dismissed = await request(app).delete("/api/me/removal-notice").set("Authorization", bruno.auth);
    expect(dismissed.status).toBe(204);
    const after = await request(app).get("/api/household").set("Authorization", bruno.auth);
    expect(after.body).toEqual({ household: null, removedFrom: null });
  });

  it("lets one admin remove another while an admin remains", async () => {
    const { app, ana, bruno } = await setup();
    await request(app)
      .patch(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth)
      .send({ role: "ADMIN" });
    const res = await request(app)
      .delete(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth);
    expect(res.status).toBe(200);
  });

  it("points people to 'leave' instead of removing themselves", async () => {
    const { app, ana, household } = await setup();
    const res = await request(app)
      .delete(`/api/household/members/${household.myMembershipId}`)
      .set("Authorization", ana.auth);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "request.invalid" } });
  });

  it.each(["bruno", "carla"] as const)("refuses %s, who isn't an admin", async (who) => {
    const context = await setup();
    const target = who === "bruno" ? context.carla : context.bruno;
    const res = await request(context.app)
      .delete(`/api/household/members/${target.membershipId}`)
      .set("Authorization", context[who].auth);
    expect(res.status).toBe(403);
    expect(await db.membership.findUnique({ where: { id: target.membershipId } })).not.toBeNull();
  });

  it("can't remove members of another household", async () => {
    const { app, bruno: brunoMember } = await setup();
    const daniSession = await signIn(app, dani);
    await createHousehold(app, daniSession, "Piso Dani");
    const res = await request(app)
      .delete(`/api/household/members/${brunoMember.membershipId}`)
      .set("Authorization", daniSession.auth);
    expect(res.status).toBe(404);
  });
});

describe("the removal note", () => {
  const currentOf = async (app: Awaited<ReturnType<typeof setup>>["app"], who: SignedIn) =>
    (await request(app).get("/api/household").set("Authorization", who.auth)).body;

  it("is dropped once the removed person joins another household through a link", async () => {
    const { app, ana, bruno } = await setup();
    await request(app).delete(`/api/household/members/${bruno.membershipId}`).set("Authorization", ana.auth);

    // Bruno opens Dani's link straight away, so the note about Casa Ana is never shown.
    const daniSession = await signIn(app, dani);
    await createHousehold(app, daniSession, "Piso Dani");
    const invited = await request(app)
      .post("/api/household/invitations")
      .set("Authorization", daniSession.auth)
      .send({ role: "MEMBER" });
    const { token } = createdInvitationSchema.parse(invited.body);
    const joined = await request(app).post("/api/invitations/accept").set("Authorization", bruno.auth).send({ token });
    expect(joined.status).toBe(200);

    // Leaving Piso Dani later must not bring back an old note about Casa Ana.
    expect((await request(app).post("/api/household/leave").set("Authorization", bruno.auth)).status).toBe(204);
    expect(await currentOf(app, bruno)).toEqual({ household: null, removedFrom: null });
  });

  it("is dropped once the removed person creates a household of their own", async () => {
    const { app, ana, bruno } = await setup();
    await request(app).delete(`/api/household/members/${bruno.membershipId}`).set("Authorization", ana.auth);

    await createHousehold(app, bruno, "Piso Bruno");
    // As the only member, leaving deletes Piso Bruno; the note about Casa Ana stays gone.
    expect((await request(app).post("/api/household/leave").set("Authorization", bruno.auth)).status).toBe(204);
    expect(await currentOf(app, bruno)).toEqual({ household: null, removedFrom: null });
  });
});

describe("POST /api/household/leave", () => {
  it.each([
    ["a member", "bruno"],
    ["a guest", "carla"],
  ] as const)("lets %s leave", async (_, who) => {
    const context = await setup();
    const leaving = context[who];
    const res = await request(context.app).post("/api/household/leave").set("Authorization", leaving.auth);
    expect(res.status).toBe(204);
    const remaining = (await householdRow(context.household.id))?.memberships.map((m) => m.userId);
    expect(remaining).toHaveLength(2);
    expect(remaining).not.toContain(leaving.user.id);
    // Leaving on your own leaves no note behind.
    expect((await request(context.app).get("/api/household").set("Authorization", leaving.auth)).body).toEqual({
      household: null,
      removedFrom: null,
    });
  });

  it("refuses to let the only admin leave while others remain", async () => {
    const { app, ana } = await setup();
    const res = await request(app).post("/api/household/leave").set("Authorization", ana.auth);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "household.last_admin" } });
  });

  it("deletes the household and its invitations when the last member leaves", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const household = await createHousehold(app, ana);
    await request(app).post("/api/household/invitations").set("Authorization", ana.auth).send({ role: "MEMBER" });

    const res = await request(app).post("/api/household/leave").set("Authorization", ana.auth);
    expect(res.status).toBe(204);
    expect(await householdRow(household.id)).toBeNull();
    expect(await db.invitation.count()).toBe(0);
  });

  it("refuses someone without a household", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const res = await request(app).post("/api/household/leave").set("Authorization", ana.auth);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "household.not_member" } });
  });
});

describe("leaving and removal with money involved", () => {
  it("lets people leave or be removed while they still owe or are owed money", async () => {
    const { app, ana, bruno, carla } = await setup();
    await addExpense(app, ana, {
      amountCents: 1000,
      split: { method: "EQUAL", userIds: [ana.user.id, bruno.user.id, carla.user.id] },
    });

    expect((await request(app).post("/api/household/leave").set("Authorization", carla.auth)).status).toBe(204);
    const removed = await request(app)
      .delete(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth);
    expect(removed.status).toBe(200);
  });

  it("deletes the household's expenses and payments when its last member leaves", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const household = await createHousehold(app, ana);
    const brunoMember = await addMember(app, household.id, bruno, "MEMBER");
    await addExpense(app, ana, {
      amountCents: 1000,
      split: { method: "EQUAL", userIds: [ana.user.id, brunoMember.user.id] },
    });
    await addSettlement(app, brunoMember, { fromUserId: brunoMember.user.id, toUserId: ana.user.id, amountCents: 500 });

    expect((await request(app).post("/api/household/leave").set("Authorization", brunoMember.auth)).status).toBe(204);
    expect((await request(app).post("/api/household/leave").set("Authorization", ana.auth)).status).toBe(204);

    expect(await householdRow(household.id)).toBeNull();
    expect(await db.expense.count()).toBe(0);
    expect(await db.expenseShare.count()).toBe(0);
    expect(await db.settlement.count()).toBe(0);
  });
});
