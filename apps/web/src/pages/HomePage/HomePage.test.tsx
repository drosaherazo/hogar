import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { expectNoA11yViolations } from "../../test/axe";
import { installFakeGoogle, renderApp } from "../../test/renderApp";
import {
  ana,
  anaIsOwed,
  anaRef,
  apiError,
  balancesView,
  brunoRef,
  handlers,
  householdView,
  member,
  server,
  shoppingItem,
} from "../../test/server";
import { firstName } from "./HomePage";

describe("firstName", () => {
  it.each([
    ["Ana García", "Ana"],
    ["  María José López ", "María"],
    ["Ana", "Ana"],
    // A starter name is one name: "Hi, Brave Otter", never "Hi, Brave".
    ["Brave Otter", "Brave Otter"],
    ["Nutria Valiente", "Nutria Valiente"],
  ])("%s → %s", (name, expected) => {
    expect(firstName(name)).toBe(expected);
  });
});

/** The browser's preferred languages, which suggest a household's currency. */
function deviceLanguages(...languages: string[]) {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
}

describe("HomePage", () => {
  describe("without a household", () => {
    it("greets the person and offers to create a household", async () => {
      server.use(handlers.signedIn(), handlers.noHousehold());
      renderApp({ path: "/" });
      expect(await screen.findByRole("heading", { level: 1, name: "Hi, Ana" })).toBeInTheDocument();
      expect(await screen.findByRole("region", { name: "You're not part of a household yet" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create a household" })).toBeEnabled();
      expect(screen.getByText(/Got an invitation link/)).toBeInTheDocument();
    });

    it("gently tells a removed person, once, and tells the server it was seen", async () => {
      let dismissals = 0;
      server.use(
        handlers.signedIn(),
        handlers.noHousehold("Piso Lavapiés"),
        http.delete("*/api/me/removal-notice", () => {
          dismissals += 1;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      renderApp({ path: "/" });

      const note = await screen.findByText(/You're no longer part of Piso Lavapiés/);
      expect(note.closest("[role=status]")).not.toBeNull();
      await waitFor(() => expect(dismissals).toBe(1));
      // Still on screen for this visit, even after the server forgot it.
      expect(screen.getByText(/You're no longer part of Piso Lavapiés/)).toBeInTheDocument();
    });

    it("creates a household with a valid name and shows it", async () => {
      deviceLanguages("en-GB", "en");
      server.use(
        handlers.signedIn(),
        handlers.noHousehold(),
        http.post("*/api/household", async ({ request }) => {
          expect(await request.json()).toEqual({ name: "Casa Ana", currency: "GBP" });
          return HttpResponse.json({ household: householdView() }, { status: 201 });
        }),
      );
      renderApp({ path: "/" });

      await userEvent.click(await screen.findByRole("button", { name: "Create a household" }));
      const dialog = await screen.findByRole("dialog", { name: "Create your household" });
      await userEvent.type(within(dialog).getByRole("textbox", { name: "Household name" }), "  Casa Ana ");
      await userEvent.click(within(dialog).getByRole("button", { name: "Create household" }));

      expect(await screen.findByRole("heading", { level: 2, name: "Casa Ana" })).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("1 person lives here")).toBeInTheDocument();
    });

    it("suggests the currency of the device's region, named in the person's language", async () => {
      deviceLanguages("es-CO", "es");
      let body: unknown;
      server.use(
        handlers.signedIn(),
        handlers.noHousehold(),
        http.post("*/api/household", async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ household: householdView({ currency: "COP" }) }, { status: 201 });
        }),
      );
      renderApp({ path: "/", locale: "es" });

      await userEvent.click(await screen.findByRole("button", { name: "Crear un hogar" }));
      const dialog = await screen.findByRole("dialog", { name: "Crea tu hogar" });
      const currency = within(dialog).getByRole("combobox", { name: "Moneda" });
      expect(currency).toHaveDisplayValue(/^peso colombiano$/i);
      expect(currency).toHaveAccessibleDescription(
        "Busca por nombre, código o país. Todo tu hogar usará esta moneda; puedes cambiarla hasta el primer gasto o pago.",
      );
      await userEvent.type(within(dialog).getByRole("textbox", { name: "Nombre del hogar" }), "Casa Bogotá");
      await userEvent.click(within(dialog).getByRole("button", { name: "Crear hogar" }));

      await waitFor(() => expect(body).toEqual({ name: "Casa Bogotá", currency: "COP" }));
    });

    it("suggests euros when the region has no currency of its own (Antarctica), and finds another by country", async () => {
      deviceLanguages("en-AQ");
      let body: unknown;
      server.use(
        handlers.signedIn(),
        handlers.noHousehold(),
        http.post("*/api/household", async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ household: householdView({ currency: "USD" }) }, { status: 201 });
        }),
      );
      renderApp({ path: "/" });

      await userEvent.click(await screen.findByRole("button", { name: "Create a household" }));
      const dialog = await screen.findByRole("dialog");
      const currency = within(dialog).getByRole("combobox", { name: "Currency" });
      expect(currency).toHaveValue("Euro");
      await userEvent.clear(currency);
      await userEvent.type(currency, "ecuador");
      await userEvent.click(await screen.findByRole("option", { name: "US Dollar USD, Used in Ecuador" }));
      expect(currency).toHaveValue("US Dollar");
      await userEvent.type(within(dialog).getByRole("textbox", { name: "Household name" }), "Our flat");
      await userEvent.click(within(dialog).getByRole("button", { name: "Create household" }));

      await waitFor(() => expect(body).toEqual({ name: "Our flat", currency: "USD" }));
    });

    it("explains an empty name without calling the API", async () => {
      let called = false;
      server.use(
        handlers.signedIn(),
        handlers.noHousehold(),
        http.post("*/api/household", () => {
          called = true;
          return HttpResponse.json({}, { status: 500 });
        }),
      );
      renderApp({ path: "/" });

      await userEvent.click(await screen.findByRole("button", { name: "Create a household" }));
      const dialog = await screen.findByRole("dialog");
      const field = within(dialog).getByRole("textbox", { name: "Household name" });
      // The form opens ready to type.
      expect(field).toHaveFocus();
      await userEvent.click(within(dialog).getByRole("button", { name: "Create household" }));

      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAccessibleDescription(expect.stringContaining("Give your household a name."));
      // Focus goes back to the field, so the error is announced where it can be fixed.
      expect(field).toHaveFocus();
      expect(called).toBe(false);
    });

    it("shows what the API answered when creating fails", async () => {
      server.use(
        handlers.signedIn(),
        handlers.noHousehold(),
        http.post("*/api/household", () => apiError(409, "household.already_member")),
      );
      renderApp({ path: "/" });

      await userEvent.click(await screen.findByRole("button", { name: "Create a household" }));
      const dialog = await screen.findByRole("dialog");
      await userEvent.type(within(dialog).getByRole("textbox"), "Casa Ana");
      await userEvent.click(within(dialog).getByRole("button", { name: "Create household" }));

      expect(await within(dialog).findByText(/You're already part of a household/)).toBeInTheDocument();
    });

    it("speaks Spanish", async () => {
      server.use(handlers.signedIn(), handlers.noHousehold());
      renderApp({ path: "/", locale: "es" });
      expect(await screen.findByRole("heading", { level: 1, name: "Hola, Ana" })).toBeInTheDocument();
      expect(await screen.findByRole("button", { name: "Crear un hogar" })).toBeEnabled();
    });

    it("shows a currency the API refused under the currency, not the name", async () => {
      deviceLanguages("en-GB");
      server.use(
        handlers.signedIn(),
        handlers.noHousehold(),
        http.post("*/api/household", () => apiError(400, "money.currency.invalid")),
      );
      renderApp({ path: "/" });

      await userEvent.click(await screen.findByRole("button", { name: "Create a household" }));
      const dialog = await screen.findByRole("dialog");
      const name = within(dialog).getByRole("textbox", { name: "Household name" });
      const currency = within(dialog).getByRole("combobox", { name: "Currency" });
      await userEvent.type(name, "Casa Ana");
      await userEvent.click(within(dialog).getByRole("button", { name: "Create household" }));

      await waitFor(() => expect(currency).toHaveAttribute("aria-invalid", "true"));
      expect(currency).toHaveAccessibleDescription(expect.stringContaining("Choose a currency from the list."));
      expect(currency).toHaveFocus();
      expect(name).not.toHaveAttribute("aria-invalid");
    });

    it("has no accessibility violations", async () => {
      server.use(handlers.signedIn(), handlers.noHousehold());
      const { container } = renderApp({ path: "/" });
      await screen.findByRole("button", { name: "Create a household" });
      await expectNoA11yViolations(container);
    });
  });

  describe("with a household", () => {
    const shared = householdView({
      members: [
        member({ id: "m_ana", userId: ana.id, name: "Ana García", role: "ADMIN", shareBps: 5000 }),
        member({ id: "m_bruno", name: "Bruno Díaz", shareBps: 5000 }),
      ],
    });

    it("shows the household, its people and a way to its settings", async () => {
      server.use(handlers.signedIn(), handlers.household(shared));
      renderApp({ path: "/" });

      const section = await screen.findByRole("region", { name: "Casa Ana" });
      expect(within(section).getByText("2 people live here")).toBeInTheDocument();
      expect(within(section).getByText("Bruno Díaz")).toBeInTheDocument();
      expect(within(section).getByRole("link", { name: "Household settings" })).toHaveAttribute(
        "href",
        "/household/settings",
      );
    });

    it("tells each person where they stand, with ways to the expenses and balances", async () => {
      server.use(handlers.signedIn(), handlers.household(shared), handlers.balances(anaIsOwed()));
      renderApp({ path: "/" });
      const money = await screen.findByRole("region", { name: "Expenses" });
      expect(await within(money).findByText("You're owed €7.70 in total")).toBeInTheDocument();
      expect(within(money).getByRole("link", { name: "See expenses" })).toHaveAttribute("href", "/expenses");
      expect(within(money).getByRole("link", { name: "See balances" })).toHaveAttribute("href", "/balances");
      expect(within(money).getByRole("link", { name: "Add expense" })).toHaveAttribute("href", "/expenses/new");
    });

    it("writes money the way the device's region does, and follows a language change at once", async () => {
      deviceLanguages("es-CO", "en");
      const pesos = { ...shared, currency: "COP" as const };
      server.use(
        handlers.signedIn(),
        handlers.household(pesos),
        handlers.balances(balancesView({ myBalanceCents: 85_000 })),
      );
      const { i18n } = renderApp({ path: "/", locale: "es" });
      const money = await screen.findByRole("region", { name: "Gastos" });
      expect(await within(money).findByText("Te deben $ 85.000 en total")).toBeInTheDocument();

      await act(() => i18n.changeLanguage("en"));
      expect(within(money).getByText("You're owed COP 85,000 in total")).toBeInTheDocument();
      // The page speaks the language; only formatting carries the region.
      expect(document.documentElement.lang).toBe("en");
    });

    describe("the money card, the page's brand moment", () => {
      const direction = (money: HTMLElement) => money.querySelector("[data-direction]");

      it("is painted in the brand color", async () => {
        server.use(handlers.signedIn(), handlers.household(shared), handlers.balances(anaIsOwed()));
        renderApp({ path: "/" });
        const money = await screen.findByRole("region", { name: "Expenses" });
        expect(money).toHaveClass("brand");
      });

      it("points inwards when the person is owed, as a hidden echo of the words", async () => {
        server.use(handlers.signedIn(), handlers.household(shared), handlers.balances(anaIsOwed()));
        renderApp({ path: "/" });
        const money = await screen.findByRole("region", { name: "Expenses" });
        const sentence = await within(money).findByText("You're owed €7.70 in total");
        const icon = direction(money);
        expect(icon).toHaveAttribute("data-direction", "in");
        expect(icon).toHaveAttribute("aria-hidden", "true");
        expect(sentence).toHaveTextContent(/^You're owed €7.70 in total$/);
      });

      it("points outwards when the person owes", async () => {
        const anaOwes = balancesView({
          balances: [
            { person: { userId: ana.id, name: ana.name, avatarUrl: null, former: false }, balanceCents: -770 },
          ],
          myBalanceCents: -770,
        });
        server.use(handlers.signedIn(), handlers.household(shared), handlers.balances(anaOwes));
        renderApp({ path: "/" });
        const money = await screen.findByRole("region", { name: "Expenses" });
        await within(money).findByText("You owe €7.70 in total");
        expect(direction(money)).toHaveAttribute("data-direction", "out");
      });

      it("shows no direction when the person is all square", async () => {
        server.use(handlers.signedIn(), handlers.household(shared));
        renderApp({ path: "/" });
        const money = await screen.findByRole("region", { name: "Expenses" });
        await within(money).findByText("You're all square");
        expect(direction(money)).toBeNull();
      });
    });

    describe("the shopping card", () => {
      it("sits right below the money card, with how many things are left to buy and the way to the list", async () => {
        server.use(
          handlers.signedIn(),
          handlers.household(shared),
          handlers.shopping([shoppingItem(), shoppingItem({ id: "item_eggs", name: "Eggs" })]),
        );
        renderApp({ path: "/" });
        const card = await screen.findByRole("region", { name: "Shopping" });
        expect(await within(card).findByText("2 things to buy")).toBeInTheDocument();
        expect(within(card).getByRole("link", { name: "See the list" })).toHaveAttribute("href", "/shopping");
        const regions = screen.getAllByRole("region");
        const money = screen.getByRole("region", { name: "Expenses" });
        expect(regions.indexOf(card)).toBe(regions.indexOf(money) + 1);
      });

      it("counts one thing in the singular", async () => {
        server.use(handlers.signedIn(), handlers.household(shared), handlers.shopping([shoppingItem()]));
        renderApp({ path: "/" });
        const card = await screen.findByRole("region", { name: "Shopping" });
        expect(await within(card).findByText("1 thing to buy")).toBeInTheDocument();
      });

      it("says so when nothing is needed, in Spanish too", async () => {
        server.use(handlers.signedIn(), handlers.household(shared));
        renderApp({ path: "/", locale: "es" });
        const card = await screen.findByRole("region", { name: "Compras" });
        expect(await within(card).findByText("Ahora no falta nada")).toBeInTheDocument();
        expect(within(card).getByRole("link", { name: "Ver la lista" })).toHaveAttribute("href", "/shopping");
      });

      it("reminds the person of their cart, still counting it as to buy, and finishes it on the list", async () => {
        server.use(
          handlers.signedIn(),
          handlers.household(shared),
          handlers.shopping([
            shoppingItem({ cartOwner: anaRef }),
            shoppingItem({ id: "item_eggs", name: "Eggs", cartOwner: anaRef }),
            shoppingItem({ id: "item_bread", name: "Bread" }),
          ]),
        );
        renderApp({ path: "/" });
        const card = await screen.findByRole("region", { name: "Shopping" });
        expect(await within(card).findByText("3 things to buy")).toBeInTheDocument();
        expect(within(card).getByText("You still have 2 in your cart")).toBeInTheDocument();

        await userEvent.click(within(card).getByRole("link", { name: "Finish shopping" }));

        expect(await screen.findByRole("dialog", { name: "Done shopping?" })).toHaveAccessibleDescription(
          "The 2 things in your cart leave the list. What you didn't find stays on it.",
        );
      });

      it("has no reminder for someone else's cart", async () => {
        server.use(
          handlers.signedIn(),
          handlers.household(shared),
          handlers.shopping([shoppingItem({ cartOwner: brunoRef })]),
        );
        renderApp({ path: "/" });
        const card = await screen.findByRole("region", { name: "Shopping" });
        expect(await within(card).findByText("1 thing to buy")).toBeInTheDocument();
        expect(within(card).queryByText(/You still have/)).not.toBeInTheDocument();
      });
    });

    it("says so when the person is all square", async () => {
      server.use(handlers.signedIn(), handlers.household(shared));
      renderApp({ path: "/" });
      const money = await screen.findByRole("region", { name: "Expenses" });
      expect(await within(money).findByText("You're all square")).toBeInTheDocument();
    });

    it("doesn't offer guests to add expenses", async () => {
      server.use(handlers.signedIn(), handlers.household({ ...shared, myRole: "GUEST" }));
      renderApp({ path: "/" });
      const money = await screen.findByRole("region", { name: "Expenses" });
      await within(money).findByText("You're all square");
      expect(within(money).queryByRole("link", { name: "Add expense" })).not.toBeInTheDocument();
    });

    it("asks admins to review the split when members changed", async () => {
      server.use(handlers.signedIn(), handlers.household({ ...shared, splitNeedsReview: true }));
      renderApp({ path: "/" });
      // The notice itself, not just any status region (the wake-up screen also has one while loading).
      const notice = (await screen.findByText("Review the split")).closest<HTMLElement>("[role=status]");
      if (!notice) throw new Error("The review notice should be a status region");
      expect(within(notice).getByRole("link", { name: "Review split" })).toHaveAttribute(
        "href",
        "/household/settings#split",
      );
    });

    it("doesn't bother members and guests about the split", async () => {
      server.use(handlers.signedIn(), handlers.household({ ...shared, myRole: "MEMBER", splitNeedsReview: true }));
      renderApp({ path: "/" });
      await screen.findByRole("region", { name: "Casa Ana" });
      expect(screen.queryByText("Review the split")).not.toBeInTheDocument();
    });

    it("offers to try again when the household can't be loaded", async () => {
      let attempts = 0;
      server.use(
        handlers.signedIn(),
        http.get("*/api/household", () => {
          attempts += 1;
          return attempts <= 2 ? apiError(500, "server.unexpected") : HttpResponse.json({ household: shared });
        }),
      );
      renderApp({ path: "/" });

      // The app retries once before giving up, so the message takes a moment.
      expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
        "We couldn't load your household.",
      );
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(await screen.findByRole("region", { name: "Casa Ana" })).toBeInTheDocument();
    });

    it("has no accessibility violations", async () => {
      server.use(handlers.signedIn(), handlers.household({ ...shared, splitNeedsReview: true }));
      const { container } = renderApp({ path: "/" });
      await screen.findByRole("region", { name: "Casa Ana" });
      await expectNoA11yViolations(container);
    });
  });

  it("keeps a signed-in person away from the login page", async () => {
    server.use(handlers.signedIn(), handlers.noHousehold());
    const { router } = renderApp({ path: "/login" });
    await screen.findByRole("heading", { level: 1, name: "Hi, Ana" });
    expect(router.state.location.pathname).toBe("/");
  });

  it("follows the account's language until the person picks one", async () => {
    server.use(handlers.signedIn({ ...ana, locale: "es" }), handlers.noHousehold());
    renderApp({ path: "/" });
    expect(await screen.findByRole("heading", { level: 1, name: "Hola, Ana" })).toBeInTheDocument();
  });

  it("changes the theme and signs out, forgetting the household", async () => {
    installFakeGoogle();
    server.use(handlers.signedIn(), handlers.household());
    const { router } = renderApp({ path: "/" });

    await userEvent.click(await screen.findByRole("button", { name: "Account menu for Ana García" }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Dark" }));
    expect(document.documentElement.dataset["theme"]).toBe("dark");

    server.resetHandlers();
    await userEvent.click(screen.getByRole("button", { name: "Account menu for Ana García" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome to Hogar" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    await waitFor(() => expect(screen.queryByText("Casa Ana")).not.toBeInTheDocument());
  });
});
