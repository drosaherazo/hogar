import { describe, expect, it } from "vitest";
import { errorCodeFrom } from "./errors";
import {
  activityQuerySchema,
  calendarDateSchema,
  expenseDescriptionSchema,
  expenseInputSchema,
  moneyCentsSchema,
  settlementInputSchema,
  updateExpenseInputSchema,
  updateSettlementInputSchema,
} from "./expenses";

const codeOf = (result: { error?: { issues: readonly { message: string }[] } }) => errorCodeFrom(result.error);

const groceries = {
  description: "Groceries",
  amountCents: 4280,
  paidById: "user-ana",
  date: "2026-11-11",
  split: { method: "WEIGHTS" },
} as const;

describe("expenseDescriptionSchema", () => {
  it("trims the description and accepts 1 to 100 characters", () => {
    expect(expenseDescriptionSchema.parse("  Groceries ")).toBe("Groceries");
    expect(expenseDescriptionSchema.safeParse("a".repeat(100)).success).toBe(true);
  });

  it("returns error codes, not sentences", () => {
    expect(codeOf(expenseDescriptionSchema.safeParse(""))).toBe("expense.description.required");
    expect(codeOf(expenseDescriptionSchema.safeParse("   "))).toBe("expense.description.required");
    expect(codeOf(expenseDescriptionSchema.safeParse("a".repeat(101)))).toBe("expense.description.too_long");
  });
});

describe("moneyCentsSchema", () => {
  it("accepts whole cents from €0.01 to €100,000.00", () => {
    expect(moneyCentsSchema.safeParse(1).success).toBe(true);
    expect(moneyCentsSchema.safeParse(10_000_000).success).toBe(true);
  });

  it.each([0, -1, 1.5, 10_000_001, "4280"])("refuses %s", (value) => {
    expect(codeOf(moneyCentsSchema.safeParse(value))).toBe("money.amount.invalid");
  });
});

describe("calendarDateSchema", () => {
  it("accepts calendar days as YYYY-MM-DD", () => {
    expect(calendarDateSchema.safeParse("2026-11-11").success).toBe(true);
    expect(calendarDateSchema.safeParse("2028-02-29").success).toBe(true);
  });

  it.each(["2026-13-01", "2026-02-30", "11/11/2026", "2026-11-11T10:00:00Z", ""])("refuses %s", (value) => {
    expect(codeOf(calendarDateSchema.safeParse(value))).toBe("money.date.invalid");
  });
});

describe("expenseInputSchema", () => {
  it("accepts the household's split", () => {
    expect(expenseInputSchema.safeParse(groceries).success).toBe(true);
  });

  it("accepts an equal split among chosen people", () => {
    const input = { ...groceries, split: { method: "EQUAL", userIds: ["user-ana", "user-bruno"] } };
    expect(expenseInputSchema.safeParse(input).success).toBe(true);
  });

  it("asks for at least one person, each only once, in an equal split", () => {
    expect(codeOf(expenseInputSchema.safeParse({ ...groceries, split: { method: "EQUAL", userIds: [] } }))).toBe(
      "expense.split.invalid",
    );
    expect(
      codeOf(expenseInputSchema.safeParse({ ...groceries, split: { method: "EQUAL", userIds: ["a", "a"] } })),
    ).toBe("expense.split.invalid");
  });

  it("accepts exact amounts that add up to the total, including people at €0.00", () => {
    const shares = [
      { userId: "user-ana", amountCents: 4280 },
      { userId: "user-bruno", amountCents: 0 },
    ];
    expect(expenseInputSchema.safeParse({ ...groceries, split: { method: "EXACT", shares } }).success).toBe(true);
  });

  it("refuses exact amounts that don't add up to the total", () => {
    const shares = [
      { userId: "user-ana", amountCents: 3000 },
      { userId: "user-bruno", amountCents: 1000 },
    ];
    expect(codeOf(expenseInputSchema.safeParse({ ...groceries, split: { method: "EXACT", shares } }))).toBe(
      "expense.split.mismatch",
    );
  });

  it("refuses exact amounts with repeated people or invalid cents", () => {
    const repeated = [
      { userId: "a", amountCents: 2140 },
      { userId: "a", amountCents: 2140 },
    ];
    expect(codeOf(expenseInputSchema.safeParse({ ...groceries, split: { method: "EXACT", shares: repeated } }))).toBe(
      "expense.split.invalid",
    );
    const fractional = [{ userId: "a", amountCents: 4279.5 }];
    expect(codeOf(expenseInputSchema.safeParse({ ...groceries, split: { method: "EXACT", shares: fractional } }))).toBe(
      "money.amount.invalid",
    );
  });

  it("refuses an unknown way of splitting", () => {
    expect(codeOf(expenseInputSchema.safeParse({ ...groceries, split: { method: "RANDOM" } }))).toBe("request.invalid");
  });

  it("validates every field with its own code", () => {
    expect(codeOf(expenseInputSchema.safeParse({ ...groceries, description: " " }))).toBe(
      "expense.description.required",
    );
    expect(codeOf(expenseInputSchema.safeParse({ ...groceries, amountCents: 0 }))).toBe("money.amount.invalid");
    expect(codeOf(expenseInputSchema.safeParse({ ...groceries, date: "yesterday" }))).toBe("money.date.invalid");
    expect(codeOf(expenseInputSchema.safeParse({ ...groceries, paidById: "" }))).toBe("request.invalid");
  });
});

describe("updateExpenseInputSchema", () => {
  it("requires the version the edit started from", () => {
    expect(updateExpenseInputSchema.safeParse({ ...groceries, version: 3 }).success).toBe(true);
    expect(updateExpenseInputSchema.safeParse(groceries).success).toBe(false);
    expect(updateExpenseInputSchema.safeParse({ ...groceries, version: 0 }).success).toBe(false);
  });

  it("checks exact amounts against the total, as when creating", () => {
    const shares = [{ userId: "a", amountCents: 1 }];
    expect(
      codeOf(updateExpenseInputSchema.safeParse({ ...groceries, version: 1, split: { method: "EXACT", shares } })),
    ).toBe("expense.split.mismatch");
  });
});

describe("settlementInputSchema", () => {
  const payment = { fromUserId: "user-bruno", toUserId: "user-ana", amountCents: 1320, date: "2026-11-11" };

  it("accepts a payment between two different people", () => {
    expect(settlementInputSchema.safeParse(payment).success).toBe(true);
  });

  it("refuses a payment to oneself", () => {
    expect(codeOf(settlementInputSchema.safeParse({ ...payment, toUserId: "user-bruno" }))).toBe(
      "settlement.same_person",
    );
  });

  it("validates the amount and the date", () => {
    expect(codeOf(settlementInputSchema.safeParse({ ...payment, amountCents: -5 }))).toBe("money.amount.invalid");
    expect(codeOf(settlementInputSchema.safeParse({ ...payment, date: "2026-11-31" }))).toBe("money.date.invalid");
  });

  it("requires a version when updating", () => {
    expect(updateSettlementInputSchema.safeParse({ ...payment, version: 1 }).success).toBe(true);
    expect(updateSettlementInputSchema.safeParse(payment).success).toBe(false);
  });
});

describe("activityQuerySchema", () => {
  it("reads query strings, with 30 items per page by default", () => {
    expect(activityQuerySchema.parse({})).toEqual({ limit: 30 });
    expect(activityQuerySchema.parse({ limit: "5", cursor: "abc" })).toEqual({ limit: 5, cursor: "abc" });
  });

  it.each(["0", "51", "two"])("refuses a limit of %s", (limit) => {
    expect(activityQuerySchema.safeParse({ limit }).success).toBe(false);
  });
});
