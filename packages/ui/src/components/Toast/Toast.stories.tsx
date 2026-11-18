import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { storyText } from "../../docs/blocks/storyLocale";
import { Button } from "../Button/Button";
import { ToastQueue, ToastRegion } from "./Toast";

const meta = {
  title: "Components/Toast",
  component: ToastRegion,
  args: { queue: new ToastQueue(), label: "", closeLabel: "" },
  parameters: { layout: "centered" },
} satisfies Meta<typeof ToastRegion>;

// Stories show nothing until their button is pressed, like in the app: a toast is the answer to
// something the person just did.

export default meta;
type Story = StoryObj<typeof meta>;

export const WithUndo: Story = {
  render: function Render(args, { globals }) {
    const [queue] = useState(() => new ToastQueue());
    const [items, setItems] = useState(["Milk", "Eggs", "Bread"]);
    const t = (en: string, es: string) => storyText(globals, { en, es });
    const names: Record<string, string> = {
      Milk: t("Milk", "Leche"),
      Eggs: t("Eggs", "Huevos"),
      Bread: t("Bread", "Pan"),
    };
    const remove = (item: string) => {
      const before = items;
      setItems(items.filter((other) => other !== item));
      queue.show({
        message: t(`You deleted ${names[item]}`, `Borraste ${names[item]}`),
        action: { label: t("Undo", "Deshacer"), onAction: () => setItems(before) },
      });
    };
    return (
      <>
        <ul style={{ display: "grid", gap: "var(--space-2)", margin: 0, padding: 0, listStyle: "none" }}>
          {items.map((item) => (
            <li key={item}>
              <Button variant="secondary" onClick={() => remove(item)}>
                {t(`Delete ${names[item]}`, `Borrar ${names[item]}`)}
              </Button>
            </li>
          ))}
        </ul>
        <ToastRegion
          {...args}
          queue={queue}
          label={t("Notifications", "Notificaciones")}
          closeLabel={t("Close", "Cerrar")}
        />
      </>
    );
  },
};

/** Offline the action can't reach the server, so it is off and says why. */
export const ActionUnavailable: Story = {
  render: function Render(args, { globals }) {
    const [queue] = useState(() => new ToastQueue());
    const t = (en: string, es: string) => storyText(globals, { en, es });
    return (
      <>
        <p id="toast-story-offline" style={{ margin: 0, maxInlineSize: "var(--size-content-sm)" }}>
          {t(
            "You're offline. Changes are available when you're back online.",
            "Estás sin conexión. Los cambios vuelven cuando recuperes la conexión.",
          )}
        </p>
        <Button
          variant="secondary"
          onClick={() =>
            queue.show({
              message: t("Done: 3 things off the list", "Listo: 3 cosas fuera de la lista"),
              action: { label: t("Undo", "Deshacer"), onAction: () => undefined },
            })
          }
        >
          {t("Finish shopping", "Terminar compra")}
        </Button>
        <ToastRegion
          {...args}
          queue={queue}
          label={t("Notifications", "Notificaciones")}
          closeLabel={t("Close", "Cerrar")}
          actionDisabled
          actionDescribedBy="toast-story-offline"
        />
      </>
    );
  },
};

/** A message on its own, for news with nothing to reverse. */
export const MessageOnly: Story = {
  render: function Render(args, { globals }) {
    const [queue] = useState(() => new ToastQueue());
    const t = (en: string, es: string) => storyText(globals, { en, es });
    return (
      <>
        <Button
          variant="secondary"
          onClick={() => queue.show({ message: t("Bruno added milk", "Bruno añadió leche") })}
        >
          {t("Show the message", "Mostrar el mensaje")}
        </Button>
        <ToastRegion
          {...args}
          queue={queue}
          label={t("Notifications", "Notificaciones")}
          closeLabel={t("Close", "Cerrar")}
        />
      </>
    );
  },
};
