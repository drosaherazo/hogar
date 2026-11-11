import { defaultWeightFor, householdResponseSchema, type HouseholdView, type Role } from "@hogar/shared";
import request from "supertest";
import { type createTestApp, db, signIn, type SignedIn } from "./testApp";
import type { GoogleIdentity } from "../src/auth/googleVerifier";

type App = ReturnType<typeof createTestApp>["app"];

/** Creates a household through the API, as `owner`. */
export async function createHousehold(app: App, owner: SignedIn, name = "Casa Ana"): Promise<HouseholdView> {
  const res = await request(app).post("/api/household").set("Authorization", owner.auth).send({ name });
  if (res.status !== 201) throw new Error(`createHousehold failed: ${res.status} ${JSON.stringify(res.body)}`);
  return householdResponseSchema.parse(res.body).household;
}

/**
 * Signs `identity` in and puts them straight into a household with `role`, skipping invitations,
 * so member and split tests don't depend on the invitation flow.
 */
export async function addMember(app: App, householdId: string, identity: GoogleIdentity, role: Role) {
  const signedIn = await signIn(app, identity);
  const membership = await db.membership.create({
    data: { householdId, userId: signedIn.user.id, role, weight: defaultWeightFor(role) },
  });
  return { ...signedIn, membershipId: membership.id };
}

/** Reads a household fresh from the database. */
export function householdRow(id: string) {
  return db.household.findUnique({ where: { id }, include: { memberships: true, invitations: true } });
}
