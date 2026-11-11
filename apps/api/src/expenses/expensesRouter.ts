import { expenseInputSchema, type ExpenseResponse } from "@hogar/shared";
import { Router } from "express";
import type { Database } from "../db";
import { parseBody } from "../household/householdRouter";
import { loadMembership, membershipOf, requireEditor } from "../household/loadMembership";
import type { ExpenseService } from "./expenseService";

/** `/api/household/expenses`: everyone in the household reads; admins and members write. */
export function createExpensesRouter(db: Database, expenses: ExpenseService) {
  const router = Router();
  router.use(loadMembership(db));

  router.get("/:id", async (req, res) => {
    const body: ExpenseResponse = {
      expense: await expenses.get(membershipOf(req).householdId, String(req.params["id"])),
    };
    res.json(body);
  });

  router.post("/", requireEditor, async (req, res) => {
    const input = parseBody(expenseInputSchema, req.body);
    const body: ExpenseResponse = { expense: await expenses.create(membershipOf(req), input) };
    res.status(201).json(body);
  });

  return router;
}
