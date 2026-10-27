import type { Meta, StoryObj } from "@storybook/react-vite";
import { House, ShoppingBasket } from "lucide-react";
import { storyText } from "../../docs/blocks/storyLocale";
import { Badge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { EmptyState } from "./EmptyState";

const meta = {
  title: "Components/EmptyState",
  component: EmptyState,
  args: { title: "", headingLevel: 2 },
  argTypes: { headingLevel: { control: "inline-radio", options: [2, 3] } },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoHousehold: Story = {
  render: (args, { globals }) => (
    <EmptyState
      {...args}
      icon={<House />}
      title={storyText(globals, { en: "You're not part of a household yet", es: "Aún no formas parte de un hogar" })}
      description={storyText(globals, {
        en: "Create one for the people you live with, or join theirs with an invitation.",
        es: "Crea uno para las personas con las que vives o únete al suyo con una invitación.",
      })}
      actions={
        <>
          <Button disabled>{storyText(globals, { en: "Create a household", es: "Crear un hogar" })}</Button>
          <Badge>{storyText(globals, { en: "Coming soon", es: "Próximamente" })}</Badge>
        </>
      }
    />
  ),
};

export const ShoppingList: Story = {
  render: (args, { globals }) => (
    <EmptyState
      {...args}
      icon={<ShoppingBasket />}
      title={storyText(globals, { en: "The list is empty", es: "La lista está vacía" })}
      description={storyText(globals, { en: "What's missing at home?", es: "¿Qué falta en casa?" })}
      actions={<Button>{storyText(globals, { en: "Add item", es: "Añadir producto" })}</Button>}
    />
  ),
};
