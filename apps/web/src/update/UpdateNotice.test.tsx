import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { createI18n } from "../i18n";
import { expectNoA11yViolations } from "../test/axe";
import { fakeServiceWorker } from "../test/fakeServiceWorker";
import { AppUpdateProvider } from "./appUpdate";
import { UpdateNotice } from "./UpdateNotice";

const NOTICE = "There's a new version of Hogar";

function renderNotice(lng: "en" | "es" = "en") {
  const worker = fakeServiceWorker();
  const notice = () => (
    <I18nextProvider i18n={createI18n({ lng })}>
      <AppUpdateProvider update={worker.update}>
        <main>
          <UpdateNotice />
        </main>
      </AppUpdateProvider>
    </I18nextProvider>
  );
  const view = render(notice());
  return { worker, notice, ...view };
}

describe("UpdateNotice", () => {
  it("stays out of the way until a new version is waiting, then fills in so it is announced", async () => {
    const { worker } = renderNotice();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    act(() => worker.arrive());
    const status = screen.getByRole("status");
    expect(status).not.toHaveTextContent(NOTICE);
    expect(await screen.findByText(NOTICE)).toBeInTheDocument();
    expect(status).toHaveTextContent(NOTICE);
  });

  it("never reloads by itself, and hands over to the new version only when asked", async () => {
    const { worker } = renderNotice();
    act(() => worker.arrive());
    await screen.findByText(NOTICE);
    expect(worker.handOver).not.toHaveBeenCalled();
    expect(worker.reload).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(worker.handOver).toHaveBeenCalledWith(true);
    const busy = screen.getByRole("button", { busy: true });
    expect(busy).toBeDisabled();
  });

  it("goes away with Later and stays away on the next page, without updating", async () => {
    const { worker, notice, unmount } = renderNotice();
    act(() => worker.arrive());
    await userEvent.click(await screen.findByRole("button", { name: "Later" }));
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();

    unmount();
    render(notice());
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    expect(worker.handOver).not.toHaveBeenCalled();
  });

  it("speaks Spanish and passes axe", async () => {
    const { worker, container } = renderNotice("es");
    act(() => worker.arrive());
    expect(await screen.findByText("Hay una versión nueva de Hogar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Más tarde" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});
