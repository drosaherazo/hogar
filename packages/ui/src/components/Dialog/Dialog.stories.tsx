import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { storyText } from "../../docs/blocks/storyLocale";
import { Button } from "../Button/Button";
import { TextField } from "../TextField/TextField";
import { Dialog } from "./Dialog";

const meta = {
  title: "Components/Dialog",
  component: Dialog,
  args: { open: false, onOpenChange: () => {}, title: "", closeLabel: "" },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Confirmation: Story = {
  render: function Render(args, { globals }) {
    const [open, setOpen] = useState(false);
    const t = (en: string, es: string) => storyText(globals, { en, es });
    return (
      <>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {t("Leave household", "Salir del hogar")}
        </Button>
        <Dialog
          {...args}
          open={open}
          onOpenChange={setOpen}
          title={t("Leave Casa Ana?", "¿Salir de Casa Ana?")}
          description={t(
            "You'll stop seeing its expenses, chores and shopping list. You can come back with a new invitation.",
            "Dejarás de ver sus gastos, tareas y lista de la compra. Puedes volver con una invitación nueva.",
          )}
          closeLabel={t("Close", "Cerrar")}
          actions={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {t("Cancel", "Cancelar")}
              </Button>
              <Button onClick={() => setOpen(false)}>{t("Leave household", "Salir del hogar")}</Button>
            </>
          }
        />
      </>
    );
  },
};

export const WithForm: Story = {
  render: function Render(args, { globals }) {
    const [open, setOpen] = useState(false);
    const t = (en: string, es: string) => storyText(globals, { en, es });
    return (
      <>
        <Button onClick={() => setOpen(true)}>{t("Create a household", "Crear un hogar")}</Button>
        <Dialog
          {...args}
          open={open}
          onOpenChange={setOpen}
          title={t("Create your household", "Crea tu hogar")}
          closeLabel={t("Close", "Cerrar")}
          actions={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {t("Cancel", "Cancelar")}
              </Button>
              <Button onClick={() => setOpen(false)}>{t("Create household", "Crear hogar")}</Button>
            </>
          }
        >
          <TextField
            label={t("Household name", "Nombre del hogar")}
            hint={t("You can change it later.", "Puedes cambiarlo más adelante.")}
          />
        </Dialog>
      </>
    );
  },
};
