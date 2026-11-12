import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { createI18n } from "../i18n";
import { expectNoA11yViolations } from "../test/axe";
import { CategoryChangeDialog, type CategoryChangeDialogProps } from "./CategoryChangeDialog";

const rows = [
  { userId: "user_ana", name: "Ana García", beforeCents: 67500, afterCents: 45000 },
  { userId: "user_bruno", name: "Bruno Díaz", beforeCents: 22500, afterCents: 45000 },
];

function renderDialog(props: Partial<CategoryChangeDialogProps> = {}) {
  const onConfirm = vi.fn();
  const i18n = createI18n({ lng: "en" });
  render(
    <I18nextProvider i18n={i18n}>
      <CategoryChangeDialog
        open
        onOpenChange={() => undefined}
        target={{ name: "Rent", ownSplit: true }}
        rows={rows}
        canApply
        saving={false}
        onConfirm={onConfirm}
        {...props}
      />
    </I18nextProvider>,
  );
  return { onConfirm, dialog: screen.getByRole("dialog", { name: "The shares would change" }) };
}

describe("CategoryChangeDialog", () => {
  it("shows each person's share before and after, in words and numbers", () => {
    const { dialog } = renderDialog();
    expect(within(dialog).getByText("Moving it to Rent changes who pays what:")).toBeInTheDocument();
    const list = within(dialog).getByRole("list", { name: "Moving it to Rent changes who pays what:" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Ana García: €675.00 → €450.00", "Bruno Díaz: €225.00 → €450.00"]);
  });

  it("applies the new category's split unless the person keeps the current shares", async () => {
    const { dialog, onConfirm } = renderDialog();
    expect(within(dialog).getByRole("radio", { name: "Apply Rent's split" })).toBeChecked();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save expense" }));
    expect(onConfirm).toHaveBeenLastCalledWith("apply");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Keep the current shares" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save expense" }));
    expect(onConfirm).toHaveBeenLastCalledWith("keep");
  });

  it("talks about the household's split for a category that follows it, or no category", () => {
    const { dialog } = renderDialog({ target: null });
    expect(within(dialog).getByText("Leaving it without a category changes who pays what:")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Apply the household's split" })).toBeChecked();
  });

  it("only offers to keep the shares when nobody pays in the new category", () => {
    const { dialog } = renderDialog({ canApply: false });
    expect(within(dialog).getByText("Rent's split has nobody paying, so it can't be applied.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("radio", { name: /Apply/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Keep the current shares" })).toBeChecked();
  });

  it("shows why it's asking again, starts on the safe button and has no accessibility violations", async () => {
    const { dialog } = renderDialog({ error: "The split changed while you were editing. Here are the new shares." });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("The split changed while you were editing.");
    expect(within(dialog).getByRole("button", { name: "Back to the form" })).toHaveFocus();
    await expectNoA11yViolations(dialog);
  });
});
