import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { createI18n } from "../i18n";
import { expectNoA11yViolations } from "../test/axe";
import { fakeAppUpdate } from "../test/fakeAppUpdate";
import { AppUpdateProvider } from "./appUpdate";
import { UpdateNotice } from "./UpdateNotice";

function renderNotice(lng: "en" | "es" = "en") {
  const update = fakeAppUpdate();
  const view = render(
    <I18nextProvider i18n={createI18n({ lng })}>
      <AppUpdateProvider update={update}>
        <main>
          <UpdateNotice />
        </main>
      </AppUpdateProvider>
    </I18nextProvider>,
  );
  return { update, ...view };
}

describe("UpdateNotice", () => {
  it("stays out of the way until a new version is waiting, then says so quietly", () => {
    const { update } = renderNotice();
    expect(screen.queryByText("There's a new version of Hogar")).not.toBeInTheDocument();
    act(() => update.arrive());
    expect(screen.getByRole("status")).toHaveTextContent("There's a new version of Hogar");
    expect(update.apply).not.toHaveBeenCalled();
  });

  it("updates when asked", async () => {
    const { update } = renderNotice();
    act(() => update.arrive());
    await userEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(update.apply).toHaveBeenCalledOnce();
  });

  it("goes away for now with Later, without updating", async () => {
    const { update } = renderNotice();
    act(() => update.arrive());
    await userEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByText("There's a new version of Hogar")).not.toBeInTheDocument();
    expect(update.apply).not.toHaveBeenCalled();
  });

  it("speaks Spanish and passes axe", async () => {
    const { update, container } = renderNotice("es");
    act(() => update.arrive());
    expect(screen.getByRole("status")).toHaveTextContent("Hay una versión nueva de Hogar");
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Más tarde" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
