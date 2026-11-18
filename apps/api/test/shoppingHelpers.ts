import { shoppingItemResponseSchema, shoppingListSchema, type ShoppingItemView } from "@hogar/shared";
import { request } from "./request";
import type { createTestApp, SignedIn } from "./testApp";

export type App = ReturnType<typeof createTestApp>["app"];

export const getList = (app: App, who: SignedIn) =>
  request(app).get("/api/household/shopping").set("Authorization", who.auth);

export const postItem = (app: App, who: SignedIn, body: object) =>
  request(app).post("/api/household/shopping/items").set("Authorization", who.auth).send(body);

/** The caller's list, in order. */
export async function listOf(app: App, who: SignedIn): Promise<ShoppingItemView[]> {
  const res = await getList(app, who);
  if (res.status !== 200) throw new Error(`listOf failed: ${res.status} ${JSON.stringify(res.body)}`);
  return shoppingListSchema.parse(res.body).items;
}

export async function addItem(app: App, who: SignedIn, name: string, note: string | null = null) {
  const res = await postItem(app, who, { name, note });
  if (res.status !== 201) throw new Error(`addItem failed: ${res.status} ${JSON.stringify(res.body)}`);
  return shoppingItemResponseSchema.parse(res.body).item;
}

export const itemPath = (id: string) => `/api/household/shopping/items/${encodeURIComponent(id)}`;

export const patchItem = (app: App, who: SignedIn, id: string, body: object) =>
  request(app).patch(itemPath(id)).set("Authorization", who.auth).send(body);

export const restoreItem = (app: App, who: SignedIn, id: string) =>
  request(app)
    .post(`${itemPath(id)}/restore`)
    .set("Authorization", who.auth);

export const deleteItem = (app: App, who: SignedIn, item: Pick<ShoppingItemView, "id" | "version">) =>
  request(app)
    .delete(`${itemPath(item.id)}?version=${item.version}`)
    .set("Authorization", who.auth);

export const putInCart = (app: App, who: SignedIn, id: string) =>
  request(app)
    .put(`${itemPath(id)}/cart`)
    .set("Authorization", who.auth);

export const takeOutOfCart = (app: App, who: SignedIn, id: string) =>
  request(app)
    .delete(`${itemPath(id)}/cart`)
    .set("Authorization", who.auth);

export const refOf = (who: SignedIn, name: string) => ({ userId: who.user.id, name, avatarUrl: null, former: false });
