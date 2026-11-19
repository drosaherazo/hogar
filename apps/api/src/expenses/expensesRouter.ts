import { expenseInputSchema, updateExpenseInputSchema, type ExpenseResponse } from "@hogar/shared";
import { Router } from "express";
import type { Database } from "../db";
import { loadMembership, membershipOf, requireEditor } from "../household/loadMembership";
import { parseBody, versionOf } from "../requestInput";
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

  router.put("/:id", requireEditor, async (req, res) => {
    const input = parseBody(updateExpenseInputSchema, req.body);
    const body: ExpenseResponse = {
      expense: await expenses.update(membershipOf(req), String(req.params["id"]), input),
    };
    res.json(body);
  });

  router.delete("/:id", requireEditor, async (req, res) => {
    await expenses.remove(membershipOf(req), String(req.params["id"]), versionOf(req));
    res.status(204).end();
  });

  return router;
}
