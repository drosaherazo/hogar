import {
  createCategoryInputSchema,
  updateCategoryInputSchema,
  updateCategorySplitInputSchema,
  type CategoryList,
  type CategoryResponse,
} from "@hogar/shared";
import { Router } from "express";
import type { Database } from "../db";
import { versionOf } from "../expenses/expensesRouter";
import { parseBody } from "../household/householdRouter";
import { loadMembership, membershipOf, requireAdmin } from "../household/loadMembership";
import type { CategoryService } from "./categoryService";

/** `/api/household/categories`: everyone in the household reads; only admins change them. */
export function createCategoriesRouter(db: Database, categories: CategoryService) {
  const router = Router();
  router.use(loadMembership(db));

  router.get("/", async (req, res) => {
    const body: CategoryList = { categories: await categories.list(membershipOf(req).householdId) };
    res.json(body);
  });

  router.post("/", requireAdmin, async (req, res) => {
    const input = parseBody(createCategoryInputSchema, req.body);
    const body: CategoryResponse = { category: await categories.create(membershipOf(req), input) };
    res.status(201).json(body);
  });

  router.patch("/:id", requireAdmin, async (req, res) => {
    const input = parseBody(updateCategoryInputSchema, req.body);
    const body: CategoryResponse = {
      category: await categories.rename(membershipOf(req), String(req.params["id"]), input),
    };
    res.json(body);
  });

  router.put("/:id/split", requireAdmin, async (req, res) => {
    const input = parseBody(updateCategorySplitInputSchema, req.body);
    const body: CategoryResponse = {
      category: await categories.updateSplit(membershipOf(req), String(req.params["id"]), input),
    };
    res.json(body);
  });

  router.delete("/:id", requireAdmin, async (req, res) => {
    await categories.remove(membershipOf(req), String(req.params["id"]), versionOf(req));
    res.status(204).end();
  });

  return router;
}
