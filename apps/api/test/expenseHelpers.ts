import {
  balancesViewSchema,
  defaultWeights,
  splitAmount,
  expenseResponseSchema,
  settlementResponseSchema,
  type BalancesView,
  type ExpenseInput,
  type ExpenseView,
  type HouseholdView,
  type SettlementInput,
  type SettlementView,
} from "@hogar/shared";
import request from "supertest";
import { currentMembers } from "../src/expenses/people";
import { addMember, createHousehold } from "./householdHelpers";
import { bruno, carla, db, signIn, type createTestApp, type SignedIn } from "./testApp";

type App = ReturnType<typeof createTestApp>["app"];
export type Member = SignedIn & { membershipId: string };

/** The test clock's day (`TestClock` starts on 2026-10-26 at 10:00 UTC). */
export const TODAY = "2026-10-26";

/**
 * A household with Ana (ADMIN) and Bruno (MEMBER), weights 3 and 1 unless told otherwise, and
 * optionally Carla (GUEST, weight 0). Join times are set explicitly so member order (and so who
 * gets leftover cents) is always Ana, Bruno, Carla.
 */
export async function homeWith(app: App, options: { weights?: [number, number]; withGuest?: boolean } = {}) {
  const [anaWeight, brunoWeight] = options.weights ?? [3, 1];
  const anaSession = await signIn(app);
  const household: HouseholdView = await createHousehold(app, anaSession);
  const ana: Member = { ...anaSession, membershipId: household.myMembershipId };
  await db.membership.update({ where: { id: ana.membershipId }, data: { weight: anaWeight } });

  const brunoMember: Member = await addMember(app, household.id, bruno, "MEMBER");
  await db.membership.update({
    where: { id: brunoMember.membershipId },
    data: { weight: brunoWeight, joinedAt: new Date("2026-10-26T10:00:01Z") },
  });

  let carlaGuest: Member | undefined;
  if (options.withGuest) {
    carlaGuest = await addMember(app, household.id, carla, "GUEST");
    await db.membership.update({
      where: { id: carlaGuest.membershipId },
      data: { joinedAt: new Date("2026-10-26T10:00:02Z") },
    });
  }
  return { household, ana, bruno: brunoMember, carla: carlaGuest };
}

/** `homeWith` plus Carla, a GUEST with weight 0. */
export async function homeWithGuest(app: App, options: { weights?: [number, number] } = {}) {
  const home = await homeWith(app, { ...options, withGuest: true });
  if (!home.carla) throw new Error("homeWith didn't add the guest");
  return { ...home, carla: home.carla };
}

export type PreviewShares = { userId: string; amountCents: number }[];

/**
 * The shares the form would show for a default split right now: the category's own weights or
 * the household's, computed with the same shared functions the web uses. Empty when `who` has
 * no household, the amount is invalid or nobody pays (the API then answers on its own).
 */
export async function previewSharesFor(
  who: SignedIn,
  amountCents: number,
  categoryId: string | null = null,
): Promise<PreviewShares> {
  // Invalid amounts are left for the API to refuse.
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return [];
  const membership = await db.membership.findUnique({ where: { userId: who.user.id } });
  if (!membership) return [];
  const members = await currentMembers(db, membership.householdId);
  const category = categoryId
    ? await db.expenseCategory.findUnique({ where: { id: categoryId }, include: { weights: true } })
    : null;
  const weights = defaultWeights(members, category);
  const sharing = members
    .map((member, index) => ({ userId: member.userId, weight: weights[index] ?? 0 }))
    .filter((member) => member.weight > 0);
  if (sharing.length === 0) return [];
  const amounts = splitAmount(
    amountCents,
    sharing.map((member) => member.weight),
  );
  return sharing.map((member, index) => ({ userId: member.userId, amountCents: amounts[index] ?? 0 }));
}

/** Sends an expense exactly as given, without filling in the previewed shares. */
export function postExpenseAsIs(app: App, who: SignedIn, body: ExpenseInput) {
  return request(app).post("/api/household/expenses").set("Authorization", who.auth).send(body);
}

/**
 * Records an expense (household split, paid by `who`, today, unless overridden). A default
 * split without `previewShares` gets the ones the form would have shown, as the web does.
 */
export async function postExpense(app: App, who: SignedIn, input: Partial<ExpenseInput>) {
  const body: ExpenseInput = {
    description: "Groceries",
    amountCents: 4280,
    paidById: who.user.id,
    date: TODAY,
    split: { method: "WEIGHTS" },
    ...input,
  };
  if (body.split.method === "WEIGHTS" && !body.split.previewShares) {
    const preview = await previewSharesFor(who, body.amountCents, body.categoryId ?? null);
    if (preview.length > 0) body.split = { method: "WEIGHTS", previewShares: preview };
  }
  return postExpenseAsIs(app, who, body);
}

/** Records an expense through the API (household split, paid by `who`, today) and returns it. */
export async function addExpense(app: App, who: SignedIn, input: Partial<ExpenseInput> = {}): Promise<ExpenseView> {
  const res = await postExpense(app, who, input);
  if (res.status !== 201) throw new Error(`addExpense failed: ${res.status} ${JSON.stringify(res.body)}`);
  return expenseResponseSchema.parse(res.body).expense;
}

export function postSettlement(
  app: App,
  who: SignedIn,
  input: Partial<SettlementInput> & Pick<SettlementInput, "fromUserId" | "toUserId">,
) {
  const body: SettlementInput = { amountCents: 1000, date: TODAY, ...input };
  return request(app).post("/api/household/settlements").set("Authorization", who.auth).send(body);
}

/** Records a payment through the API and returns it. */
export async function addSettlement(
  app: App,
  who: SignedIn,
  input: Partial<SettlementInput> & Pick<SettlementInput, "fromUserId" | "toUserId">,
): Promise<SettlementView> {
  const res = await postSettlement(app, who, input);
  if (res.status !== 201) throw new Error(`addSettlement failed: ${res.status} ${JSON.stringify(res.body)}`);
  return settlementResponseSchema.parse(res.body).settlement;
}

/** The input that would save `expense` as it is: the starting point for an edit. */
export function inputOf(expense: ExpenseView): ExpenseInput {
  const people = expense.split.shares.map((share) => share.person.userId);
  return {
    description: expense.description,
    amountCents: expense.amountCents,
    paidById: expense.paidBy.userId,
    date: expense.date,
    categoryId: expense.category?.id ?? null,
    split:
      expense.split.method === "EQUAL"
        ? { method: "EQUAL", userIds: people }
        : expense.split.method === "EXACT"
          ? {
              method: "EXACT",
              shares: expense.split.shares.map((share) => ({
                userId: share.person.userId,
                amountCents: share.amountCents,
              })),
            }
          : { method: "WEIGHTS" },
  };
}

export function putExpense(app: App, who: SignedIn, id: string, body: ExpenseInput & { version: number }) {
  return request(app).put(`/api/household/expenses/${id}`).set("Authorization", who.auth).send(body);
}

export function deleteExpense(app: App, who: SignedIn, id: string, version?: number) {
  const query = version === undefined ? {} : { version: String(version) };
  return request(app).delete(`/api/household/expenses/${id}`).query(query).set("Authorization", who.auth);
}

export function putSettlement(app: App, who: SignedIn, id: string, body: SettlementInput & { version: number }) {
  return request(app).put(`/api/household/settlements/${id}`).set("Authorization", who.auth).send(body);
}

export function deleteSettlement(app: App, who: SignedIn, id: string, version?: number) {
  const query = version === undefined ? {} : { version: String(version) };
  return request(app).delete(`/api/household/settlements/${id}`).query(query).set("Authorization", who.auth);
}

export async function balancesOf(app: App, who: SignedIn): Promise<BalancesView> {
  const res = await request(app).get("/api/household/balances").set("Authorization", who.auth);
  if (res.status !== 200) throw new Error(`balancesOf failed: ${res.status} ${JSON.stringify(res.body)}`);
  return balancesViewSchema.parse(res.body);
}

/** `{ userId: cents }` of everyone in the balances, for compact assertions. */
export function balanceByUser(view: BalancesView): Record<string, number> {
  return Object.fromEntries(view.balances.map((entry) => [entry.person.userId, entry.balanceCents]));
}

/** `{ userId: cents }` of an expense's shares. */
export function sharesByUser(expense: ExpenseView): Record<string, number> {
  return Object.fromEntries(expense.split.shares.map((share) => [share.person.userId, share.amountCents]));
}
