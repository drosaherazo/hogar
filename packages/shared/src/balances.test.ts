import { describe, expect, it } from "vitest";
import { netBalances, suggestSettlements, viewerPart, type BalanceTotals } from "./balances";
import { splitAmount } from "./split";

const totals = (entries: Partial<Record<keyof BalanceTotals, Record<string, number>>>): BalanceTotals => ({
  paid: new Map(Object.entries(entries.paid ?? {})),
  owed: new Map(Object.entries(entries.owed ?? {})),
  sent: new Map(Object.entries(entries.sent ?? {})),
  received: new Map(Object.entries(entries.received ?? {})),
});

describe("netBalances", () => {
  it("is what someone paid, minus their shares, plus payments made, minus payments received", () => {
    const balances = netBalances(
      totals({
        paid: { ana: 4280 },
        owed: { ana: 3210, bruno: 1070 },
        sent: { bruno: 500 },
        received: { ana: 500 },
      }),
    );
    expect(balances.get("ana")).toBe(4280 - 3210 - 500);
    expect(balances.get("bruno")).toBe(-1070 + 500);
  });

  it("includes everyone who appears in any total, even at zero", () => {
    const balances = netBalances(totals({ paid: { ana: 1000 }, owed: { ana: 1000 } }));
    expect([...balances]).toEqual([["ana", 0]]);
  });
});

describe("suggestSettlements", () => {
  it("collapses a chain of debts into one payment (the spec's example)", () => {
    // Ana paid €20 for Bruno only; Bruno paid €20 for Carla only.
    const balances = netBalances(totals({ paid: { ana: 2000, bruno: 2000 }, owed: { bruno: 2000, carla: 2000 } }));
    expect(balances.get("bruno")).toBe(0);
    const people = ["ana", "bruno", "carla"].map((userId) => ({ userId, balanceCents: balances.get(userId) ?? 0 }));
    expect(suggestSettlements(people)).toEqual([{ fromUserId: "carla", toUserId: "ana", amountCents: 2000 }]);
  });

  it("matches the biggest debt with the biggest credit first", () => {
    expect(
      suggestSettlements([
        { userId: "ana", balanceCents: 3000 },
        { userId: "bruno", balanceCents: 1000 },
        { userId: "carla", balanceCents: -2500 },
        { userId: "dani", balanceCents: -1500 },
      ]),
    ).toEqual([
      { fromUserId: "carla", toUserId: "ana", amountCents: 2500 },
      { fromUserId: "dani", toUserId: "bruno", amountCents: 1000 },
      { fromUserId: "dani", toUserId: "ana", amountCents: 500 },
    ]);
  });

  it("breaks ties by the order it was given, so everyone sees the same list", () => {
    const people = [
      { userId: "ana", balanceCents: 500 },
      { userId: "bruno", balanceCents: 500 },
      { userId: "carla", balanceCents: -500 },
      { userId: "dani", balanceCents: -500 },
    ];
    expect(suggestSettlements(people)).toEqual([
      { fromUserId: "carla", toUserId: "ana", amountCents: 500 },
      { fromUserId: "dani", toUserId: "bruno", amountCents: 500 },
    ]);
  });

  it("suggests nothing when everyone is square", () => {
    expect(suggestSettlements([])).toEqual([]);
    expect(suggestSettlements([{ userId: "ana", balanceCents: 0 }])).toEqual([]);
  });

  it("refuses balances that don't add up to zero", () => {
    expect(() => suggestSettlements([{ userId: "ana", balanceCents: 1 }])).toThrow();
  });
});

describe("viewerPart", () => {
  const groceries = {
    paidById: "ana",
    amountCents: 4280,
    shares: [
      { userId: "ana", amountCents: 3210 },
      { userId: "bruno", amountCents: 1070 },
    ],
  };

  it("says what the viewer lent when they paid for others", () => {
    expect(viewerPart(groceries, "ana")).toEqual({ kind: "lent", amountCents: 1070 });
    expect(viewerPart({ ...groceries, shares: [{ userId: "bruno", amountCents: 4280 }] }, "ana")).toEqual({
      kind: "lent",
      amountCents: 4280,
    });
  });

  it("says what the viewer owes when someone else paid", () => {
    expect(viewerPart(groceries, "bruno")).toEqual({ kind: "owes", amountCents: 1070 });
  });

  it("says the viewer isn't involved otherwise", () => {
    expect(viewerPart(groceries, "carla")).toEqual({ kind: "none", amountCents: 0 });
    expect(viewerPart({ ...groceries, shares: [{ userId: "ana", amountCents: 4280 }] }, "ana")).toEqual({
      kind: "none",
      amountCents: 0,
    });
    expect(
      viewerPart({ paidById: "ana", amountCents: 2, shares: [{ userId: "carla", amountCents: 0 }] }, "carla"),
    ).toEqual({ kind: "none", amountCents: 0 });
  });
});

// ---------------------------------------------------------------------------
// Generated households (research R15): many random cases, always the same ones.
// ---------------------------------------------------------------------------

/** mulberry32: a tiny seeded generator, so a failing case can be reproduced. */
function seeded(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)] as T;
  return { int, pick };
}

interface GeneratedExpense {
  paidById: string;
  amountCents: number;
  shares: { userId: string; amountCents: number }[];
}

function generateHousehold(random: ReturnType<typeof seeded>) {
  const people = Array.from({ length: random.int(1, 8) }, (_, index) => `p${index}`);
  const weights = people.map(() => random.int(0, 5));
  if (!weights.some((weight) => weight > 0)) weights[0] = 1;

  const expenses: GeneratedExpense[] = Array.from({ length: random.int(0, 15) }, () => {
    const amountCents = random.int(1, 200_000);
    const method = random.pick(["WEIGHTS", "EQUAL", "EXACT"] as const);
    let chosen: string[];
    let amounts: number[];
    if (method === "WEIGHTS") {
      chosen = people;
      amounts = splitAmount(amountCents, weights);
    } else {
      chosen = people.filter(() => random.int(0, 1) === 1);
      if (chosen.length === 0) chosen = [random.pick(people)];
      // EXACT amounts are any partition of the total; random weights give one.
      const partWeights = chosen.map(() => (method === "EQUAL" ? 1 : random.int(1, 9)));
      amounts = splitAmount(amountCents, partWeights);
    }
    return {
      paidById: random.pick(people),
      amountCents,
      shares: chosen.map((userId, index) => ({ userId, amountCents: amounts[index] ?? 0 })),
    };
  });

  const settlements =
    people.length < 2
      ? []
      : Array.from({ length: random.int(0, 5) }, () => {
          const fromUserId = random.pick(people);
          const others = people.filter((person) => person !== fromUserId);
          return { fromUserId, toUserId: random.pick(others), amountCents: random.int(1, 50_000) };
        });

  return { people, expenses, settlements };
}

function add(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

describe("money rules on generated households", () => {
  const random = seeded(20261111);
  const households = Array.from({ length: 300 }, () => generateHousehold(random));

  it.each(households.map((household, index) => [index, household] as const))(
    "household #%i keeps every rule",
    (_, { people, expenses, settlements }) => {
      const sums: BalanceTotals = { paid: new Map(), owed: new Map(), sent: new Map(), received: new Map() };
      for (const expense of expenses) {
        // Shares always add up to the amount.
        expect(expense.shares.reduce((total, share) => total + share.amountCents, 0)).toBe(expense.amountCents);
        add(sums.paid as Map<string, number>, expense.paidById, expense.amountCents);
        for (const share of expense.shares) add(sums.owed as Map<string, number>, share.userId, share.amountCents);
      }
      for (const settlement of settlements) {
        add(sums.sent as Map<string, number>, settlement.fromUserId, settlement.amountCents);
        add(sums.received as Map<string, number>, settlement.toUserId, settlement.amountCents);
      }

      const balances = netBalances(sums);
      // Balances always add up to exactly zero.
      expect([...balances.values()].reduce((total, value) => total + value, 0)).toBe(0);

      const ordered = people.map((userId) => ({ userId, balanceCents: balances.get(userId) ?? 0 }));
      const suggestions = suggestSettlements(ordered);
      const nonZero = ordered.filter((person) => person.balanceCents !== 0).length;
      expect(suggestions.length).toBeLessThanOrEqual(Math.max(nonZero - 1, 0));

      // Nobody both pays and receives, and every suggested amount is positive.
      const payers = new Set(suggestions.map((suggestion) => suggestion.fromUserId));
      for (const suggestion of suggestions) {
        expect(payers.has(suggestion.toUserId)).toBe(false);
        expect(suggestion.amountCents).toBeGreaterThan(0);
      }

      // Recording every suggestion leaves everyone at zero.
      const after = new Map(balances);
      for (const { fromUserId, toUserId, amountCents } of suggestions) {
        add(after, fromUserId, amountCents);
        add(after, toUserId, -amountCents);
      }
      for (const value of after.values()) expect(value).toBe(0);

      // Same input, same output.
      expect(suggestSettlements(ordered)).toEqual(suggestions);
    },
  );
});
