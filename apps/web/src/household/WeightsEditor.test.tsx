import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { createI18n } from "../i18n";
import { expectNoA11yViolations } from "../test/axe";
import { sharesForDrafts, WeightsEditor } from "./WeightsEditor";

const members = [
  { id: "m_ana", name: "Ana García" },
  { id: "m_bruno", name: "Bruno Díaz" },
];

function Editor({ initial }: { initial: string[] }) {
  const [drafts, setDrafts] = useState(initial);
  return (
    <WeightsEditor
      members={members}
      drafts={drafts}
      onChange={(index, draft) => setDrafts((current) => current.map((value, i) => (i === index ? draft : value)))}
    />
  );
}

function renderEditor(initial = ["3", "1"]) {
  return render(
    <I18nextProvider i18n={createI18n({ lng: "en" })}>
      <main>
        <Editor initial={initial} />
      </main>
    </I18nextProvider>,
  );
}

describe("WeightsEditor", () => {
  it("shows each member's weight and the share it gives them", () => {
    renderEditor();
    expect(screen.getByRole("spinbutton", { name: "Ana García" })).toHaveValue(3);
    expect(screen.getByRole("spinbutton", { name: "Ana García" })).toHaveAccessibleDescription("75% of shared costs");
    expect(screen.getByRole("spinbutton", { name: "Bruno Díaz" })).toHaveAccessibleDescription("25% of shared costs");
  });

  it("updates the shares as weights are typed, and flags a weight out of range", async () => {
    renderEditor();
    const bruno = screen.getByRole("spinbutton", { name: "Bruno Díaz" });
    await userEvent.clear(bruno);
    await userEvent.type(bruno, "3");
    expect(screen.getByRole("spinbutton", { name: "Ana García" })).toHaveAccessibleDescription("50% of shared costs");
    await userEvent.type(bruno, "00");
    expect(bruno).toHaveAttribute("aria-invalid", "true");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderEditor();
    await expectNoA11yViolations(container);
  });
});

describe("sharesForDrafts", () => {
  it("turns valid weights into basis points, and waits while one isn't valid", () => {
    expect(sharesForDrafts(["1", "1"])).toEqual([5000, 5000]);
    expect(sharesForDrafts(["0", "0"])).toEqual([0, 0]);
    expect(sharesForDrafts(["1", ""])).toBeNull();
    expect(sharesForDrafts(["1", "101"])).toBeNull();
  });
});
