import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";
import { ana, categoryView, handlers, homeView, server, starterCategories } from "../../test/server";

const PATH = "/household/settings";

async function section() {
  return screen.findByRole("region", { name: "Categories" });
}

const rentOwn = categoryView({
  id: "cat_rent",
  name: "Rent",
  emoji: "🏠",
  ownSplit: true,
  needsReview: true,
  weights: [
    { membershipId: "m_ana", userId: ana.id, weight: 1, shareBps: 5000 },
    { membershipId: "m_bruno", userId: "user_m_bruno", weight: 1, shareBps: 5000 },
  ],
});

describe("CategoriesSection", () => {
  it("shows admins every category in order, how it's split and a way to change it", async () => {
    server.use(
      handlers.signedIn(),
      handlers.household(homeView()),
      handlers.categories([rentOwn, ...starterCategories().slice(1)]),
    );
    renderApp({ path: PATH });
    const region = await section();
    const rows = await within(region).findAllByRole("listitem");
    ["Rent", "Groceries", "Utilities", "Leisure", "Other"].forEach((name, index) =>
      expect(rows[index]).toHaveTextContent(name),
    );
    expect(rows[0]).toHaveTextContent("Own split: Ana García 50% and Bruno Díaz 50%");
    expect(rows[0]).toHaveTextContent("Review this split: people have changed.");
    expect(rows[1]).toHaveTextContent("Follows the household's split");
    expect(within(region).getByRole("button", { name: "Add category" })).toBeEnabled();
    expect(within(region).getByRole("button", { name: "Edit Rent" })).toBeInTheDocument();
    expect(within(region).getAllByRole("button", { name: /^Edit / })).toHaveLength(5);
  });

  it.each(["MEMBER", "GUEST"] as const)("shows a %s the same list, read only", async (role) => {
    server.use(handlers.signedIn(), handlers.household(homeView({ myRole: role })), handlers.categories([rentOwn]));
    renderApp({ path: PATH });
    const region = await section();
    expect(await within(region).findByText("Own split: Ana García 50% and Bruno Díaz 50%")).toBeInTheDocument();
    expect(within(region).getByText("Only admins can change categories.")).toBeInTheDocument();
    expect(within(region).queryByRole("button")).not.toBeInTheDocument();
    expect(within(region).queryByText("Review this split: people have changed.")).not.toBeInTheDocument();
  });

  it("stops offering to add at 30 categories, and says why", async () => {
    const thirty = Array.from({ length: 30 }, (_, index) =>
      categoryView({ id: `cat_${index}`, name: `Category ${index + 1}`, position: index + 1 }),
    );
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.categories(thirty));
    renderApp({ path: PATH });
    const region = await section();
    expect(await within(region).findByRole("button", { name: "Add category" })).toBeDisabled();
    expect(within(region).getByText("You've reached 30 categories. Delete one to add another.")).toBeInTheDocument();
  });

  it("invites admins to add one when there are none", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.categories([]));
    renderApp({ path: PATH });
    const region = await section();
    expect(
      await within(region).findByText("No categories yet. Add one to start labeling expenses."),
    ).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Add category" })).toBeInTheDocument();
  });

  it("brings the section into view from the expense form's link", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()));
    renderApp({ path: `${PATH}#categories` });
    const heading = await screen.findByRole("heading", { name: "Categories" });
    expect(heading).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    server.use(handlers.signedIn(), handlers.household(homeView()), handlers.categories([rentOwn]));
    const { container } = renderApp({ path: PATH });
    const region = await section();
    await within(region).findByText("Own split: Ana García 50% and Bruno Díaz 50%");
    await expectNoA11yViolations(container);
  });
});
