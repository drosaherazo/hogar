import {
  addShoppingItemInputSchema,
  finishShoppingInputSchema,
  shoppingSuggestionsQuerySchema,
  undoFinishShoppingInputSchema,
  updateShoppingItemInputSchema,
  type FinishShoppingResponse,
  type ShoppingItemResponse,
  type ShoppingItemsResponse,
  type ShoppingList,
  type ShoppingSuggestions,
} from "@hogar/shared";
import { Router } from "express";
import type { Database } from "../db";
import { badRequest } from "../httpError";
import { versionOf } from "../expenses/expensesRouter";
import { parseBody } from "../household/householdRouter";
import { loadMembership, membershipOf, requireEditor } from "../household/loadMembership";
import type { ShoppingService } from "./shoppingService";

/** `/api/household/shopping`: everyone in the household reads the list; admins and members change it. */
export function createShoppingRouter(db: Database, shopping: ShoppingService) {
  const router = Router();
  router.use(loadMembership(db));

  router.get("/", async (req, res) => {
    const body: ShoppingList = await shopping.list(membershipOf(req).householdId);
    res.json(body);
  });

  router.get("/suggestions", async (req, res) => {
    const query = shoppingSuggestionsQuerySchema.safeParse(req.query);
    if (!query.success) throw badRequest("request.invalid");
    const body: ShoppingSuggestions = {
      suggestions: await shopping.suggestions(membershipOf(req).householdId, query.data.q),
    };
    res.json(body);
  });

  router.post("/items", requireEditor, async (req, res) => {
    const input = parseBody(addShoppingItemInputSchema, req.body);
    const body: ShoppingItemResponse = { item: await shopping.add(membershipOf(req), input) };
    res.status(201).json(body);
  });

  router.patch("/items/:id", requireEditor, async (req, res) => {
    const input = parseBody(updateShoppingItemInputSchema, req.body);
    const body: ShoppingItemResponse = {
      item: await shopping.edit(membershipOf(req), String(req.params["id"]), input),
    };
    res.json(body);
  });

  router.post("/items/:id/restore", requireEditor, async (req, res) => {
    const body: ShoppingItemResponse = { item: await shopping.restore(membershipOf(req), String(req.params["id"])) };
    res.json(body);
  });

  router.put("/items/:id/cart", requireEditor, async (req, res) => {
    const body: ShoppingItemResponse = { item: await shopping.putInCart(membershipOf(req), String(req.params["id"])) };
    res.json(body);
  });

  router.delete("/items/:id/cart", requireEditor, async (req, res) => {
    const body: ShoppingItemResponse = {
      item: await shopping.takeOutOfCart(membershipOf(req), String(req.params["id"])),
    };
    res.json(body);
  });

  router.delete("/items/:id", requireEditor, async (req, res) => {
    await shopping.remove(membershipOf(req), String(req.params["id"]), versionOf(req));
    res.status(204).end();
  });

  router.post("/finish", requireEditor, async (req, res) => {
    const input = parseBody(finishShoppingInputSchema, req.body);
    const body: FinishShoppingResponse = await shopping.finish(membershipOf(req), input);
    res.status(body.expense === null ? 200 : 201).json(body);
  });

  router.post("/finish/undo", requireEditor, async (req, res) => {
    const { itemIds } = parseBody(undoFinishShoppingInputSchema, req.body);
    const body: ShoppingItemsResponse = { items: await shopping.undoFinish(membershipOf(req), itemIds) };
    res.json(body);
  });

  return router;
}
