import type { CategoryView } from "@hogar/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import { ana, apiError, categoryView, handlers, homeView, server } from "../../test/server";

const PATH = "/household/settings";

/** Rent following the household (3 / 1), used by 12 expenses. */
const rent = categoryView({ id: "cat_rent", name: "Rent", emoji: "🏠", expenseCount: 12 });
const rentOwn = categoryView({
  ...rent,
  ownSplit: true,
  version: 2,
  weights: [
    { membershipId: "m_ana", userId: ana.id, weight: 1, shareBps: 5000 },
    { membershipId: "m_bruno", userId: "user_m_bruno", weight: 1, shareBps: 5000 },
  ],
});

interface Call {
  method: string;
  path: string;
  body: unknown;
}

/** Serves `categories` and records every write; `answers` can override a write's response. */
function setup(categories: CategoryView[], answers: Partial<Record<string, () => Response>> = {}) {
  const calls: Call[] = [];
  const record = async (request: Request) => {
    const url = new URL(request.url);
    calls.push({
      method: request.method,
      path: `${url.pathname}${url.search}`,
      body: request.method === "DELETE" ? null : await request.json(),
    });
  };
  server.use(
    handlers.signedIn(),
    handlers.household(homeView()),
    handlers.categories(categories),
    http.post("*/api/household/categories", async ({ request }) => {
      await record(request);
      return (
        answers["POST"]?.() ??
        HttpResponse.json({ category: categoryView({ id: "cat_new", name: "Dog" }) }, { status: 201 })
      );
    }),
    http.patch("*/api/household/categories/:id", async ({ request }) => {
      await record(request);
      return (
        answers["PATCH"]?.() ?? HttpResponse.json({ category: { ...rent, name: "Flat", version: rent.version + 1 } })
      );
    }),
    http.put("*/api/household/categories/:id/split", async ({ request }) => {
      await record(request);
      return answers["PUT"]?.() ?? HttpResponse.json({ category: { ...rentOwn, version: 3 } });
    }),
    http.delete("*/api/household/categories/:id", async ({ request }) => {
      await record(request);
      return answers["DELETE"]?.() ?? new HttpResponse(null, { status: 204 });
    }),
  );
  renderApp({ path: PATH });
  return calls;
}

async function open(name: RegExp | string) {
  const region = await screen.findByRole("region", { name: "Categories" });
  await userEvent.click(await within(region).findByRole("button", { name }));
  return screen.findByRole("dialog");
}

describe("CategoryDialog", () => {
  it("adds a category with a trimmed name and an emoji, and says it's saved", async () => {
    const calls = setup([rent]);
    const dialog = await open("Add category");
    expect(dialog).toHaveAccessibleName("New category");
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveFocus();
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "  Dog ");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Emoji (optional)" }), "🐶");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save category" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Category saved.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls).toEqual([{ method: "POST", path: "/api/household/categories", body: { name: "Dog", emoji: "🐶" } }]);
  });

  it("explains a problem next to the field, without closing", async () => {
    const calls = setup([rent], { POST: () => apiError(400, "category.name.taken") });
    const dialog = await open("Add category");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Emoji (optional)" }), "ab");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save category" }));
    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveAccessibleDescription(
      expect.stringContaining("Give the category a name"),
    );
    expect(within(dialog).getByRole("textbox", { name: "Emoji (optional)" })).toHaveAccessibleDescription(
      expect.stringContaining("Pick just one emoji"),
    );
    expect(calls).toHaveLength(0);

    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Rent");
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Emoji (optional)" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save category" }));
    expect(await within(dialog).findByText("There's already a category with that name.")).toBeInTheDocument();
  });

  it("renames with the version it started from, and only sends what changed", async () => {
    const calls = setup([rent]);
    const dialog = await open("Edit Rent");
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("Rent");
    await userEvent.clear(name);
    await userEvent.type(name, "Flat");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save category" }));
    await screen.findByRole("status");
    expect(calls).toEqual([
      { method: "PATCH", path: "/api/household/categories/cat_rent", body: { name: "Flat", emoji: "🏠", version: 1 } },
    ]);
  });

  it("shows when someone else changed it meanwhile", async () => {
    setup([rent], { PATCH: () => apiError(409, "category.changed") });
    const dialog = await open("Edit Rent");
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Flat");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save category" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Someone changed this category while you were editing it.",
    );
  });

  it("gives a category its own split, starting from a copy of the household's weights", async () => {
    const calls = setup([rent]);
    const dialog = await open("Edit Rent");
    expect(within(dialog).getByText("The household's split: Ana García 75% and Bruno Díaz 25%")).toBeInTheDocument();
    const box = within(dialog).getByRole("checkbox", { name: "Use its own split" });
    expect(box).toHaveAccessibleDescription("If unticked, it follows the household's split.");
    await userEvent.click(box);

    const anaWeight = within(dialog).getByRole("spinbutton", { name: "Ana García" });
    expect(anaWeight).toHaveValue(3);
    expect(within(dialog).getByRole("spinbutton", { name: "Bruno Díaz" })).toHaveValue(1);
    await userEvent.clear(anaWeight);
    await userEvent.type(anaWeight, "1");
    expect(anaWeight).toHaveAccessibleDescription("50% of shared costs");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save category" }));

    await screen.findByRole("status");
    expect(calls).toEqual([
      {
        method: "PUT",
        path: "/api/household/categories/cat_rent/split",
        body: {
          version: 1,
          ownSplit: true,
          weights: [
            { membershipId: "m_ana", weight: 1 },
            { membershipId: "m_bruno", weight: 1 },
          ],
        },
      },
    ]);
  });

  it("asks before going back to the household's split", async () => {
    const calls = setup([rentOwn]);
    const dialog = await open("Edit Rent");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Use its own split" }));

    const confirm = await screen.findByRole("dialog", { name: "Follow the household's split?" });
    expect(confirm).toHaveAccessibleDescription(
      "Rent will follow the household's split again. Its own weights will be discarded. Expenses already added won't change.",
    );
    expect(within(confirm).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await userEvent.click(within(confirm).getByRole("button", { name: "Follow the household's split" }));
    expect(within(dialog).getByRole("checkbox", { name: "Use its own split" })).not.toBeChecked();

    await userEvent.click(within(dialog).getByRole("button", { name: "Save category" }));
    await screen.findByRole("status");
    expect(calls).toEqual([
      { method: "PUT", path: "/api/household/categories/cat_rent/split", body: { version: 2, ownSplit: false } },
    ]);
  });

  it("renames, then saves the split with the version the rename returned", async () => {
    const calls = setup([rent]);
    const dialog = await open("Edit Rent");
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Flat");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Use its own split" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save category" }));
    await screen.findByRole("status");
    expect(calls.map((call) => [call.method, (call.body as { version: number }).version])).toEqual([
      ["PATCH", 1],
      ["PUT", 2],
    ]);
  });

  it("keeps the dialog open when the split fails after the rename, and only retries the split", async () => {
    let failSplit = true;
    const calls = setup([rent], {
      PUT: () => {
        if (failSplit) {
          failSplit = false;
          return apiError(409, "split.members_changed");
        }
        return HttpResponse.json({ category: { ...rentOwn, name: "Flat", version: 3 } });
      },
    });
    const dialog = await open("Edit Rent");
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Name" }));
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Flat");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Use its own split" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save category" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The household's members changed");

    await userEvent.click(within(dialog).getByRole("button", { name: "Save category" }));
    await screen.findByRole("status");
    expect(calls.map((call) => call.method)).toEqual(["PATCH", "PUT", "PUT"]);
  });

  it.each([
    [rent, "12 expenses will be left without a category. Nobody's share will change.", false],
    [
      categoryView({ ...rent, expenseCount: 1 }),
      "1 expense will be left without a category. Nobody's share will change.",
      false,
    ],
    [categoryView({ ...rent, expenseCount: 0 }), "No expenses use it.", false],
    [rentOwn, "12 expenses will be left without a category. Nobody's share will change.", true],
  ])("asks before deleting, saying what happens to its expenses (%#)", async (category, text, mentionsSplit) => {
    const calls = setup([category]);
    const dialog = await open("Edit Rent");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete category" }));

    const confirm = await screen.findByRole("dialog", { name: "Delete Rent?" });
    expect(confirm).toHaveAccessibleDescription(text);
    expect(within(confirm).queryByText("Its own split will be discarded too.") !== null).toBe(mentionsSplit);
    expect(within(confirm).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await expectNoA11yViolations(confirm);

    await userEvent.click(within(confirm).getByRole("button", { name: "Delete category" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Category deleted.");
    expect(calls).toEqual([
      { method: "DELETE", path: `/api/household/categories/cat_rent?version=${category.version}`, body: null },
    ]);
  });

  it("has no accessibility violations", async () => {
    setup([rentOwn]);
    const dialog = await open("Edit Rent");
    await expectNoA11yViolations(dialog);
  });
});
