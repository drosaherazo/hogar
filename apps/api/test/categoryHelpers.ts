import {
  categoryListSchema,
  categoryResponseSchema,
  createdInvitationSchema,
  type CategoryView,
  type InvitableRole,
} from "@hogar/shared";
import request from "supertest";
import type { GoogleIdentity } from "../src/auth/googleVerifier";
import { signIn, type createTestApp, type SignedIn } from "./testApp";

type App = ReturnType<typeof createTestApp>["app"];

export const getCategories = (app: App, who: SignedIn) =>
  request(app).get("/api/household/categories").set("Authorization", who.auth);

/** The caller's categories, in list order. */
export async function listCategories(app: App, who: SignedIn): Promise<CategoryView[]> {
  const res = await getCategories(app, who);
  if (res.status !== 200) throw new Error(`listCategories failed: ${res.status} ${JSON.stringify(res.body)}`);
  return categoryListSchema.parse(res.body).categories;
}

/** One of the caller's categories, by its exact name. */
export async function categoryNamed(app: App, who: SignedIn, name: string): Promise<CategoryView> {
  const found = (await listCategories(app, who)).find((category) => category.name === name);
  if (!found) throw new Error(`No category named ${name}`);
  return found;
}

export const postCategory = (app: App, who: SignedIn, body: object) =>
  request(app).post("/api/household/categories").set("Authorization", who.auth).send(body);

export async function addCategory(app: App, who: SignedIn, name: string, emoji: string | null = null) {
  const res = await postCategory(app, who, { name, emoji });
  if (res.status !== 201) throw new Error(`addCategory failed: ${res.status} ${JSON.stringify(res.body)}`);
  return categoryResponseSchema.parse(res.body).category;
}

export const patchCategory = (app: App, who: SignedIn, id: string, body: object) =>
  request(app).patch(`/api/household/categories/${id}`).set("Authorization", who.auth).send(body);

export const putCategorySplit = (app: App, who: SignedIn, id: string, body: object) =>
  request(app).put(`/api/household/categories/${id}/split`).set("Authorization", who.auth).send(body);

export function deleteCategory(app: App, who: SignedIn, id: string, version?: number) {
  const query = version === undefined ? {} : { version: String(version) };
  return request(app).delete(`/api/household/categories/${id}`).query(query).set("Authorization", who.auth);
}

/** Gives a category its own split with these weights, by membership id, and returns it. */
export async function giveOwnSplit(
  app: App,
  admin: SignedIn,
  category: CategoryView,
  weights: Record<string, number>,
): Promise<CategoryView> {
  const res = await putCategorySplit(app, admin, category.id, {
    version: category.version,
    ownSplit: true,
    weights: Object.entries(weights).map(([membershipId, weight]) => ({ membershipId, weight })),
  });
  if (res.status !== 200) throw new Error(`giveOwnSplit failed: ${res.status} ${JSON.stringify(res.body)}`);
  return categoryResponseSchema.parse(res.body).category;
}

/** `identity` joins the admin's household through a real invitation. */
export async function joinWithInvitation(app: App, admin: SignedIn, identity: GoogleIdentity, role: InvitableRole) {
  const invited = await request(app).post("/api/household/invitations").set("Authorization", admin.auth).send({ role });
  const { token } = createdInvitationSchema.parse(invited.body);
  const joiner = await signIn(app, identity);
  const res = await request(app).post("/api/invitations/accept").set("Authorization", joiner.auth).send({ token });
  if (res.status !== 200) throw new Error(`join failed: ${res.status} ${JSON.stringify(res.body)}`);
  return joiner;
}
