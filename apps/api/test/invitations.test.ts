import {
  createdInvitationSchema,
  householdResponseSchema,
  invitationListSchema,
  invitationPreviewSchema,
  type InvitableRole,
} from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { hashSecretToken } from "../src/auth/tokens";
import { addMember, createHousehold, householdRow } from "./householdHelpers";
import { bruno, carla, createTestApp, dani, db, signIn, type SignedIn } from "./testApp";

const HOUR = 60 * 60 * 1000;
type App = ReturnType<typeof createTestApp>["app"];

async function invite(app: App, admin: SignedIn, role: InvitableRole = "MEMBER") {
  const res = await request(app).post("/api/household/invitations").set("Authorization", admin.auth).send({ role });
  expect(res.status).toBe(201);
  return createdInvitationSchema.parse(res.body);
}

const lookup = (app: App, who: SignedIn, token: string) =>
  request(app).post("/api/invitations/lookup").set("Authorization", who.auth).send({ token });

const accept = (app: App, who: SignedIn, token: string) =>
  request(app).post("/api/invitations/accept").set("Authorization", who.auth).send({ token });

/** Ana with a household she administers. */
async function setup(options: { invitationRateLimit?: number } = {}) {
  const context = createTestApp(options);
  const ana = await signIn(context.app);
  const household = await createHousehold(context.app, ana);
  return { ...context, ana, household };
}

describe("creating invitations", () => {
  it("returns the token once and stores only its hash", async () => {
    const { app, ana, clock } = await setup();
    const { invitation, token } = await invite(app, ana, "GUEST");

    expect(invitation).toEqual({
      id: invitation.id,
      role: "GUEST",
      createdByName: "Ana García",
      expiresAt: new Date(clock.current.getTime() + 12 * HOUR).toISOString(),
      status: "pending",
    });
    expect(token).toMatch(/^[\w-]{43}$/);
    const stored = await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(stored.tokenHash).toBe(hashSecretToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it("never invites someone as admin", async () => {
    const { app, ana } = await setup();
    const res = await request(app)
      .post("/api/household/invitations")
      .set("Authorization", ana.auth)
      .send({ role: "ADMIN" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "request.invalid" } });
  });

  it.each(["MEMBER", "GUEST"] as const)("refuses a %s", async (role) => {
    const { app, household } = await setup();
    const other = await addMember(app, household.id, bruno, role);
    const res = await request(app)
      .post("/api/household/invitations")
      .set("Authorization", other.auth)
      .send({ role: "MEMBER" });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "household.forbidden" } });
  });

  it("refuses someone without a household", async () => {
    const { app } = await setup();
    const loner = await signIn(app, dani);
    const res = await request(app)
      .post("/api/household/invitations")
      .set("Authorization", loner.auth)
      .send({ role: "MEMBER" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "household.not_member" } });
  });

  it("allows at most 10 pending invitations, counting only live ones", async () => {
    const { app, ana, clock } = await setup();
    for (let index = 0; index < 10; index += 1) await invite(app, ana);
    const refused = await request(app)
      .post("/api/household/invitations")
      .set("Authorization", ana.auth)
      .send({ role: "MEMBER" });
    expect(refused.status).toBe(409);
    expect(refused.body).toEqual({ error: { code: "invitation.limit_reached" } });

    clock.advance(12 * HOUR);
    await invite(app, ana);
  });
});

describe("listing, renewing and revoking", () => {
  it("lists pending and expired invitations, newest first, and hides used and revoked ones", async () => {
    const { app, ana, clock } = await setup();
    const old = await invite(app, ana, "GUEST");
    clock.advance(11 * HOUR);
    const used = await invite(app, ana);
    await accept(app, await signIn(app, bruno), used.token);
    const revoked = await invite(app, ana);
    await request(app).delete(`/api/household/invitations/${revoked.invitation.id}`).set("Authorization", ana.auth);
    clock.advance(1000);
    const fresh = await invite(app, ana);
    clock.advance(HOUR);

    const res = await request(app).get("/api/household/invitations").set("Authorization", ana.auth);
    const { invitations } = invitationListSchema.parse(res.body);
    expect(invitations.map((invitation) => [invitation.id, invitation.status])).toEqual([
      [fresh.invitation.id, "pending"],
      [old.invitation.id, "expired"],
    ]);
  });

  it("renews an invitation: the old link stops working, the new one keeps the role", async () => {
    const { app, ana, clock } = await setup();
    const first = await invite(app, ana, "GUEST");
    clock.advance(13 * HOUR);

    const res = await request(app)
      .post(`/api/household/invitations/${first.invitation.id}/renew`)
      .set("Authorization", ana.auth);
    expect(res.status).toBe(201);
    const renewed = createdInvitationSchema.parse(res.body);
    expect(renewed.invitation.role).toBe("GUEST");
    expect(renewed.invitation.expiresAt).toBe(new Date(clock.current.getTime() + 12 * HOUR).toISOString());
    expect(renewed.token).not.toBe(first.token);

    const carlaSession = await signIn(app, carla);
    expect((await lookup(app, carlaSession, first.token)).body).toEqual({ error: { code: "invitation.revoked" } });
    expect((await lookup(app, carlaSession, renewed.token)).status).toBe(200);
  });

  it("revokes an invitation so its link stops working at once", async () => {
    const { app, ana } = await setup();
    const { invitation, token } = await invite(app, ana);
    const res = await request(app).delete(`/api/household/invitations/${invitation.id}`).set("Authorization", ana.auth);
    expect(res.status).toBe(204);

    const brunoSession = await signIn(app, bruno);
    const join = await accept(app, brunoSession, token);
    expect(join.status).toBe(410);
    expect(join.body).toEqual({ error: { code: "invitation.revoked" } });
  });

  it("doesn't touch another household's invitations", async () => {
    const { app, ana } = await setup();
    const { invitation } = await invite(app, ana);
    const brunoSession = await signIn(app, bruno);
    await createHousehold(app, brunoSession, "Piso Bruno");

    const revoke = await request(app)
      .delete(`/api/household/invitations/${invitation.id}`)
      .set("Authorization", brunoSession.auth);
    expect(revoke.status).toBe(404);
    expect(revoke.body).toEqual({ error: { code: "invitation.not_found" } });
    const renew = await request(app)
      .post(`/api/household/invitations/${invitation.id}/renew`)
      .set("Authorization", brunoSession.auth);
    expect(renew.status).toBe(404);
    expect((await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } })).revokedAt).toBeNull();
  });

  it.each(["MEMBER", "GUEST"] as const)("hides the list from a %s", async (role) => {
    const { app, household } = await setup();
    const other = await addMember(app, household.id, bruno, role);
    const res = await request(app).get("/api/household/invitations").set("Authorization", other.auth);
    expect(res.status).toBe(403);
  });
});

describe("looking up an invitation", () => {
  it("tells someone without a household that they can join", async () => {
    const { app, ana } = await setup();
    const { token } = await invite(app, ana, "GUEST");
    const res = await lookup(app, await signIn(app, bruno), token);
    expect(res.status).toBe(200);
    expect(invitationPreviewSchema.parse(res.body)).toEqual(
      expect.objectContaining({
        householdName: "Casa Ana",
        inviterName: "Ana García",
        role: "GUEST",
        viewer: "can_join",
      }),
    );
  });

  it("recognises members of the same household and people with another one", async () => {
    const { app, ana } = await setup();
    const { token } = await invite(app, ana);
    expect((await lookup(app, ana, token)).body.viewer).toBe("already_member");

    const brunoSession = await signIn(app, bruno);
    await createHousehold(app, brunoSession, "Piso Bruno");
    expect((await lookup(app, brunoSession, token)).body.viewer).toBe("has_other_household");
  });

  it("explains unknown, expired and used links", async () => {
    const { app, ana, clock } = await setup();
    const brunoSession = await signIn(app, bruno);

    const unknown = await lookup(app, brunoSession, "not-a-real-token");
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: { code: "invitation.not_found" } });

    const used = await invite(app, ana);
    await accept(app, await signIn(app, carla), used.token);
    expect((await lookup(app, brunoSession, used.token)).body).toEqual({ error: { code: "invitation.used" } });

    const expiring = await invite(app, ana);
    clock.advance(12 * HOUR);
    const expired = await lookup(app, brunoSession, expiring.token);
    expect(expired.status).toBe(410);
    expect(expired.body).toEqual({ error: { code: "invitation.expired" } });
  });

  it("requires a signed-in person and a token", async () => {
    const { app } = await setup();
    expect((await request(app).post("/api/invitations/lookup").send({ token: "x" })).status).toBe(401);
    const brunoSession = await signIn(app, bruno);
    const missing = await request(app).post("/api/invitations/lookup").set("Authorization", brunoSession.auth).send({});
    expect(missing.status).toBe(400);
  });
});

describe("accepting an invitation", () => {
  it.each([
    ["MEMBER", 1],
    ["GUEST", 0],
  ] as const)("joins as %s with weight %i and asks admins to review the split", async (role, weight) => {
    const { app, ana, household, clock } = await setup();
    const { token } = await invite(app, ana, role);
    clock.advance(1000);
    const brunoSession = await signIn(app, bruno);

    const res = await accept(app, brunoSession, token);
    expect(res.status).toBe(200);
    const joined = householdResponseSchema.parse(res.body).household;
    expect(joined.myRole).toBe(role);
    expect(joined.members.at(-1)).toEqual(expect.objectContaining({ name: "Bruno Díaz", role, weight }));

    const adminView = householdResponseSchema.parse(
      (await request(app).get("/api/household").set("Authorization", ana.auth)).body,
    ).household;
    expect(adminView.splitNeedsReview).toBe(true);
    const row = await householdRow(household.id);
    expect(row?.invitations[0]?.usedById).toBe(brunoSession.user.id);
  });

  it("refuses someone who already has another household and keeps the invitation", async () => {
    const { app, ana } = await setup();
    const { invitation, token } = await invite(app, ana);
    const brunoSession = await signIn(app, bruno);
    await createHousehold(app, brunoSession, "Piso Bruno");

    const res = await accept(app, brunoSession, token);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "household.already_member" } });
    expect((await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } })).usedAt).toBeNull();
  });

  it("lets only one of two people use the same link at the same time", async () => {
    const { app, ana, household } = await setup();
    const { token } = await invite(app, ana);
    const [brunoSession, carlaSession] = await Promise.all([signIn(app, bruno), signIn(app, carla)]);

    const results = await Promise.all([accept(app, brunoSession, token), accept(app, carlaSession, token)]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 410]);
    expect(results.find((res) => res.status === 410)?.body).toEqual({ error: { code: "invitation.used" } });
    expect((await householdRow(household.id))?.memberships).toHaveLength(2);
  });

  it("lets someone who left come back with a new invitation", async () => {
    const { app, ana, household } = await setup();
    const brunoSession = await signIn(app, bruno);
    await accept(app, brunoSession, (await invite(app, ana)).token);
    await db.membership.delete({ where: { userId: brunoSession.user.id } });

    const again = await accept(app, brunoSession, (await invite(app, ana)).token);
    expect(again.status).toBe(200);
    expect((await householdRow(household.id))?.memberships).toHaveLength(2);
  });

  it("is rate limited", async () => {
    const { app } = await setup({ invitationRateLimit: 2 });
    const brunoSession = await signIn(app, bruno);
    await lookup(app, brunoSession, "a");
    await lookup(app, brunoSession, "b");
    const limited = await lookup(app, brunoSession, "c");
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: { code: "request.rate_limited" } });
  });
});
