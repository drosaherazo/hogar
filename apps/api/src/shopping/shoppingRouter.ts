import {
  addShoppingItemInputSchema,
  updateShoppingItemInputSchema,
  type ShoppingItemResponse,
  type ShoppingList,
} from "@hogar/shared";
import { Router } from "express";
import type { Database } from "../db";
import { versionOf } from "../expenses/expensesRouter";
import { parseBody } from "../household/householdRouter";
import { loadMembership, membershipOf, requireEditor } from "../household/loadMembership";
import type { ShoppingService } from "./shoppingService";

/** `/api/household/shopping`: everyone in the household reads the list; admins and members change it. */
export function createShoppingRouter(db: Database, shopping: ShoppingService) {
  const router = Router();
  router.use(loadMembership(db));

  router.get("/", async (req, res) => {
    const body: ShoppingList = { items: await shopping.list(membershipOf(req).householdId) };
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

  return router;
}
