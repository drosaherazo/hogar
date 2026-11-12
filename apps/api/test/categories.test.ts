import { categoryResponseSchema, expenseResponseSchema, STARTER_CATEGORIES } from "@hogar/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  addCategory,
  categoryNamed,
  deleteCategory,
  getCategories,
  giveOwnSplit,
  joinWithInvitation,
  listCategories,
  patchCategory,
  postCategory,
  putCategorySplit,
} from "./categoryHelpers";
import {
  addExpense,
  balanceByUser,
  balancesOf,
  deleteExpense,
  homeWith,
  homeWithGuest,
  sharesByUser,
} from "./expenseHelpers";
import { createHousehold } from "./householdHelpers";
import { carla, createTestApp, dani, db, signIn } from "./testApp";

const leave = (app: ReturnType<typeof createTestApp>["app"], auth: string) =>
  request(app).post("/api/household/leave").set("Authorization", auth);

describe("starter categories", () => {
  it("are created with a new household, in the creator's language", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    await createHousehold(app, ana);
    const categories = await listCategories(app, ana);
    expect(categories.map((category) => category.name)).toEqual(["Alquiler", "Comida", "Suministros", "Ocio", "Otros"]);
    expect(categories.map((category) => category.emoji)).toEqual(STARTER_CATEGORIES.map((category) => category.emoji));
    expect(categories.map((category) => category.position)).toEqual([1, 2, 3, 4, 5]);
    for (const category of categories) {
      expect(category).toMatchObject({
        ownSplit: false,
        weights: null,
        needsReview: false,
        expenseCount: 0,
        version: 1,
      });
    }
  });

  it("are in English for someone who uses the app in English", async () => {
    const { app } = createTestApp();
    const dan = await signIn(app, dani);
    await db.user.update({ where: { id: dan.user.id }, data: { locale: "en" } });
    await createHousehold(app, dan, "Dani's flat");
    expect((await listCategories(app, dan)).map((category) => category.name)).toEqual([
      "Rent",
      "Groceries",
      "Utilities",
      "Leisure",
      "Other",
    ]);
  });
});

describe("GET /api/household/categories", () => {
  it("is open to everyone in the household, guests included", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    for (const who of [ana, bruno, carla]) {
      const res = await getCategories(app, who);
      expect(res.status).toBe(200);
      expect(res.body.categories).toHaveLength(5);
    }
  });

  it("answers 404 without a household, and to someone who left", async () => {
    const { app } = createTestApp();
    const { bruno } = await homeWith(app);
    const outsider = await signIn(app, dani);
    expect((await getCategories(app, outsider)).body).toEqual({ error: { code: "household.not_member" } });
    expect((await leave(app, bruno.auth)).status).toBe(204);
    const res = await getCategories(app, bruno);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "household.not_member" } });
  });

  it("shows each household only its own categories", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    await addCategory(app, ana, "Dog", "🐶");
    const dan = await signIn(app, dani);
    await createHousehold(app, dan, "Dani's flat");
    const names = (await listCategories(app, dan)).map((category) => category.name);
    expect(names).not.toContain("Dog");
    expect(names).toHaveLength(5);
  });

  it("counts the live expenses in each category, in list order", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    await addExpense(app, ana, { categoryId: rent.id });
    const gone = await addExpense(app, ana, { categoryId: rent.id });
    await deleteExpense(app, ana, gone.id, 1);
    const categories = await listCategories(app, ana);
    expect(categories[0]).toMatchObject({ name: "Alquiler", expenseCount: 1 });
    expect(categories[1]).toMatchObject({ name: "Comida", expenseCount: 0 });
  });
});

describe("POST /api/household/categories", () => {
  it("lets an admin add a category, last in the list and following the household", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const res = await postCategory(app, ana, { name: " Dog ", emoji: "🐶" });
    expect(res.status).toBe(201);
    expect(categoryResponseSchema.parse(res.body).category).toMatchObject({
      name: "Dog",
      emoji: "🐶",
      position: 6,
      ownSplit: false,
      weights: null,
      version: 1,
    });
    expect((await listCategories(app, ana)).at(-1)?.name).toBe("Dog");
  });

  it("refuses members and guests", async () => {
    const { app } = createTestApp();
    const { bruno, carla } = await homeWithGuest(app);
    for (const who of [bruno, carla]) {
      const res = await postCategory(app, who, { name: "Dog" });
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: { code: "household.forbidden" } });
    }
  });

  it("answers 404 without a household", async () => {
    const { app } = createTestApp();
    await homeWith(app);
    const outsider = await signIn(app, dani);
    expect((await postCategory(app, outsider, { name: "Dog" })).status).toBe(404);
  });

  it.each([
    ["an empty name", { name: "  " }, "category.name.required"],
    ["a name longer than 30 characters", { name: "a".repeat(31) }, "category.name.too_long"],
    ["two emoji", { name: "Dog", emoji: "🐶🐱" }, "category.emoji.invalid"],
    ["a name another category has, in other case and with spaces", { name: "  comida " }, "category.name.taken"],
  ])("refuses %s", async (_label, body, code) => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const res = await postCategory(app, ana, body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code } });
  });

  it("treats underscores and percent signs in names literally", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    await addCategory(app, ana, "a_c");
    expect((await postCategory(app, ana, { name: "abc" })).status).toBe(201);
    expect((await postCategory(app, ana, { name: "A_C" })).body).toEqual({ error: { code: "category.name.taken" } });
  });

  it("stops at 30 categories", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    for (let index = 6; index <= 30; index += 1) await addCategory(app, ana, `Category ${index}`);
    const res = await postCategory(app, ana, { name: "One more" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "category.limit_reached" } });
  });
});

describe("PATCH /api/household/categories/:id", () => {
  it("renames a category and changes its emoji without touching any share", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const utilities = await categoryNamed(app, ana, "Suministros");
    const bill = await addExpense(app, ana, { amountCents: 1001, categoryId: utilities.id });
    const before = await balancesOf(app, ana);

    const res = await patchCategory(app, ana, utilities.id, { name: "Facturas", emoji: "🧾", version: 1 });
    expect(res.status).toBe(200);
    expect(categoryResponseSchema.parse(res.body).category).toMatchObject({
      name: "Facturas",
      emoji: "🧾",
      version: 2,
    });

    const after = await request(app).get(`/api/household/expenses/${bill.id}`).set("Authorization", bruno.auth);
    const expense = expenseResponseSchema.parse(after.body).expense;
    expect(expense.category).toEqual({ id: utilities.id, name: "Facturas", emoji: "🧾" });
    expect(sharesByUser(expense)).toEqual(sharesByUser(bill));
    expect(balanceByUser(await balancesOf(app, ana))).toEqual(balanceByUser(before));
  });

  it("allows changing only the case of its own name", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    expect((await patchCategory(app, ana, rent.id, { name: "ALQUILER", emoji: null, version: 1 })).status).toBe(200);
  });

  it("refuses a name another category has", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    const res = await patchCategory(app, ana, rent.id, { name: "comida", emoji: null, version: 1 });
    expect(res.body).toEqual({ error: { code: "category.name.taken" } });
  });

  it("refuses a change based on an outdated version", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    await patchCategory(app, ana, rent.id, { name: "Piso", emoji: "🏠", version: 1 });
    const res = await patchCategory(app, ana, rent.id, { name: "Casa", emoji: "🏠", version: 1 });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: "category.changed" } });
  });

  it("refuses members, guests and other households", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    const body = { name: "Piso", emoji: null, version: 1 };
    for (const who of [bruno, carla]) expect((await patchCategory(app, who, rent.id, body)).status).toBe(403);

    const dan = await signIn(app, dani);
    await createHousehold(app, dan, "Dani's flat");
    const res = await patchCategory(app, dan, rent.id, body);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "category.not_found" } });
  });
});

describe("DELETE /api/household/categories/:id", () => {
  it("leaves its expenses, live and deleted, without a category and with the same shares and balances", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const groceries = await categoryNamed(app, ana, "Comida");
    const live = await addExpense(app, ana, { amountCents: 4280, categoryId: groceries.id });
    const gone = await addExpense(app, ana, { amountCents: 999, categoryId: groceries.id });
    await deleteExpense(app, ana, gone.id, 1);
    const before = await balancesOf(app, ana);

    const res = await deleteCategory(app, ana, groceries.id, 1);
    expect(res.status).toBe(204);

    const rows = await db.expense.findMany({ include: { shares: true }, orderBy: { amountCents: "asc" } });
    expect(rows.map((row) => row.categoryId)).toEqual([null, null]);
    const after = await request(app).get(`/api/household/expenses/${live.id}`).set("Authorization", ana.auth);
    const expense = expenseResponseSchema.parse(after.body).expense;
    expect(expense.category).toBeNull();
    expect(sharesByUser(expense)).toEqual(sharesByUser(live));
    expect(balanceByUser(await balancesOf(app, ana))).toEqual(balanceByUser(before));
    expect((await listCategories(app, ana)).map((category) => category.name)).not.toContain("Comida");
  });

  it("lets the name be used again", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const groceries = await categoryNamed(app, ana, "Comida");
    await deleteCategory(app, ana, groceries.id, 1);
    expect((await postCategory(app, ana, { name: "Comida" })).status).toBe(201);
  });

  it("can delete every category, and expenses still work without one", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    for (const category of await listCategories(app, ana)) await deleteCategory(app, ana, category.id, 1);
    expect(await listCategories(app, ana)).toEqual([]);
    expect((await addExpense(app, ana)).category).toBeNull();
  });

  it("needs the version it was based on", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    expect((await deleteCategory(app, ana, rent.id)).body).toEqual({ error: { code: "request.invalid" } });
    await patchCategory(app, ana, rent.id, { name: "Piso", emoji: null, version: 1 });
    const stale = await deleteCategory(app, ana, rent.id, 1);
    expect(stale.status).toBe(409);
    expect(stale.body).toEqual({ error: { code: "category.changed" } });
  });

  it("refuses members, guests and other households", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    for (const who of [bruno, carla]) expect((await deleteCategory(app, who, rent.id, 1)).status).toBe(403);
    const dan = await signIn(app, dani);
    await createHousehold(app, dan, "Dani's flat");
    expect((await deleteCategory(app, dan, rent.id, 1)).status).toBe(404);
    expect(await db.expenseCategory.findUnique({ where: { id: rent.id } })).not.toBeNull();
  });
});

describe("PUT /api/household/categories/:id/split", () => {
  it("gives a category its own weights, in member order with their shares", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    const res = await putCategorySplit(app, ana, rent.id, {
      version: 1,
      ownSplit: true,
      weights: [
        { membershipId: bruno.membershipId, weight: 1 },
        { membershipId: ana.membershipId, weight: 1 },
      ],
    });
    expect(res.status).toBe(200);
    expect(categoryResponseSchema.parse(res.body).category).toMatchObject({
      ownSplit: true,
      version: 2,
      needsReview: false,
      weights: [
        { membershipId: ana.membershipId, userId: ana.user.id, weight: 1, shareBps: 5000 },
        { membershipId: bruno.membershipId, userId: bruno.user.id, weight: 1, shareBps: 5000 },
      ],
    });
  });

  it("goes back to the household's split when unticked, discarding its weights", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const rent = await giveOwnSplit(app, ana, await categoryNamed(app, ana, "Alquiler"), {
      [ana.membershipId]: 1,
      [bruno.membershipId]: 1,
    });
    const res = await putCategorySplit(app, ana, rent.id, { version: rent.version, ownSplit: false });
    expect(res.status).toBe(200);
    expect(categoryResponseSchema.parse(res.body).category).toMatchObject({
      ownSplit: false,
      weights: null,
      version: 3,
    });
    expect(await db.categoryWeight.count({ where: { categoryId: rent.id } })).toBe(0);
  });

  it("needs exactly one weight per current member", async () => {
    const { app } = createTestApp();
    const { ana } = await homeWith(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    const missing = await putCategorySplit(app, ana, rent.id, {
      version: 1,
      ownSplit: true,
      weights: [{ membershipId: ana.membershipId, weight: 1 }],
    });
    expect(missing.status).toBe(409);
    expect(missing.body).toEqual({ error: { code: "split.members_changed" } });

    const stranger = await putCategorySplit(app, ana, rent.id, {
      version: 1,
      ownSplit: true,
      weights: [
        { membershipId: ana.membershipId, weight: 1 },
        { membershipId: "someone-else", weight: 1 },
      ],
    });
    expect(stranger.status).toBe(409);
    expect((await categoryNamed(app, ana, "Alquiler")).ownSplit).toBe(false);
  });

  it.each([
    ["all weights 0", 0, 0, "split.all_zero"],
    ["a weight above 100", 101, 1, "split.weight.invalid"],
  ])("refuses %s", async (_label, anaWeight, brunoWeight, code) => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    const res = await putCategorySplit(app, ana, rent.id, {
      version: 1,
      ownSplit: true,
      weights: [
        { membershipId: ana.membershipId, weight: anaWeight },
        { membershipId: bruno.membershipId, weight: brunoWeight },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code } });
  });

  it("refuses an outdated version, members, guests and other households", async () => {
    const { app } = createTestApp();
    const { ana, bruno, carla } = await homeWithGuest(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    const body = { version: 1, ownSplit: false };
    for (const who of [bruno, carla]) {
      const res = await putCategorySplit(app, who, rent.id, body);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: { code: "household.forbidden" } });
    }
    const dan = await signIn(app, dani);
    await createHousehold(app, dan, "Dani's flat");
    expect((await putCategorySplit(app, dan, rent.id, body)).status).toBe(404);

    await patchCategory(app, ana, rent.id, { name: "Piso", emoji: null, version: 1 });
    expect((await putCategorySplit(app, ana, rent.id, body)).body).toEqual({ error: { code: "category.changed" } });
  });

  it("never changes expenses that are already saved", async () => {
    const { app } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const rent = await categoryNamed(app, ana, "Alquiler");
    const saved = await addExpense(app, ana, { amountCents: 90000, categoryId: rent.id });
    const before = await balancesOf(app, ana);

    const own = await giveOwnSplit(app, ana, rent, { [ana.membershipId]: 1, [bruno.membershipId]: 1 });
    const changed = await giveOwnSplit(app, ana, own, { [ana.membershipId]: 1, [bruno.membershipId]: 4 });
    await putCategorySplit(app, ana, rent.id, { version: changed.version, ownSplit: false });

    const row = await db.expense.findUniqueOrThrow({ where: { id: saved.id }, include: { shares: true } });
    expect(Object.fromEntries(row.shares.map((share) => [share.userId, share.amountCents]))).toEqual(
      sharesByUser(saved),
    );
    expect(balanceByUser(await balancesOf(app, ana))).toEqual(balanceByUser(before));
  });

  it("works in a household of one, which never needs a review", async () => {
    const { app } = createTestApp();
    const ana = await signIn(app);
    const household = await createHousehold(app, ana);
    const rent = await categoryNamed(app, ana, "Alquiler");
    const own = await giveOwnSplit(app, ana, rent, { [household.myMembershipId]: 1 });
    expect(own).toMatchObject({ ownSplit: true, needsReview: false });
  });
});

describe("people joining and leaving", () => {
  it("gives someone who joins their joining weight in every category with its own split, and asks for a review", async () => {
    const { app, clock } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const rent = await giveOwnSplit(app, ana, await categoryNamed(app, ana, "Alquiler"), {
      [ana.membershipId]: 1,
      [bruno.membershipId]: 1,
    });

    clock.advance(1000);
    const carlaMember = await joinWithInvitation(app, ana, carla, "MEMBER");
    const daniGuest = await joinWithInvitation(app, ana, dani, "GUEST");

    const categories = await listCategories(app, ana);
    const after = categories.find((category) => category.id === rent.id);
    expect(after?.needsReview).toBe(true);
    expect(after?.weights?.map((entry) => [entry.userId, entry.weight])).toEqual([
      [ana.user.id, 1],
      [bruno.user.id, 1],
      [carlaMember.user.id, 1],
      [daniGuest.user.id, 0],
    ]);
    // Categories that follow the household get no rows and no notice.
    const groceries = categories.find((category) => category.name === "Comida");
    expect(groceries).toMatchObject({ weights: null, needsReview: false });
    expect(await db.categoryWeight.count({ where: { categoryId: groceries?.id ?? "" } })).toBe(0);

    // Saving the split again clears the notice.
    const reviewed = await giveOwnSplit(
      app,
      ana,
      after ?? rent,
      Object.fromEntries((after?.weights ?? []).map((entry) => [entry.membershipId, entry.weight])),
    );
    expect(reviewed.needsReview).toBe(false);
  });

  it("removes the weight of someone who leaves or is removed, keeping everyone else's", async () => {
    const { app, clock } = createTestApp();
    const { ana, bruno } = await homeWith(app);
    const carlaMember = await joinWithInvitation(app, ana, carla, "MEMBER");
    const carlaMembership = await db.membership.findUniqueOrThrow({ where: { userId: carlaMember.user.id } });
    const rent = await giveOwnSplit(app, ana, await categoryNamed(app, ana, "Alquiler"), {
      [ana.membershipId]: 2,
      [bruno.membershipId]: 1,
      [carlaMembership.id]: 3,
    });

    clock.advance(1000);
    expect((await leave(app, carlaMember.auth)).status).toBe(204);
    let view = await categoryNamed(app, ana, "Alquiler");
    expect(view.weights?.map((entry) => entry.weight)).toEqual([2, 1]);
    expect(view.needsReview).toBe(true);

    const removed = await request(app)
      .delete(`/api/household/members/${bruno.membershipId}`)
      .set("Authorization", ana.auth);
    expect(removed.status).toBe(200);
    view = await categoryNamed(app, ana, "Alquiler");
    expect(view.weights?.map((entry) => entry.weight)).toEqual([2]);
    expect(await db.categoryWeight.count({ where: { categoryId: rent.id } })).toBe(1);
  });
});
