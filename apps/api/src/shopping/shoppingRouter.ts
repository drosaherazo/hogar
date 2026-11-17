import { addShoppingItemInputSchema, type ShoppingItemResponse, type ShoppingList } from "@hogar/shared";
import { Router } from "express";
import type { Database } from "../db";
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

  return router;
}
