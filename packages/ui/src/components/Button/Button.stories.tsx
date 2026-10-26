import type { Meta, StoryObj } from "@storybook/react-vite";
import { LogOut, Plus } from "lucide-react";
import { storyText } from "../../docs/blocks/storyLocale";
import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  args: { variant: "primary", size: "md", disabled: false, fullWidth: false },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost"] },
    size: { control: "inline-radio", options: ["md", "sm"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  render: (args, { globals }) => (
    <Button {...args} icon={<Plus />}>
      {storyText(globals, { en: "Add expense", es: "Añadir gasto" })}
    </Button>
  ),
};

export const Secondary: Story = {
  args: { variant: "secondary" },
  render: (args, { globals }) => (
    <Button {...args}>{storyText(globals, { en: "Join with an invitation", es: "Unirme con una invitación" })}</Button>
  ),
};

export const Ghost: Story = {
  args: { variant: "ghost" },
  render: (args, { globals }) => (
    <Button {...args} icon={<LogOut />}>
      {storyText(globals, { en: "Sign out", es: "Cerrar sesión" })}
    </Button>
  ),
};

export const Loading: Story = {
  render: (args, { globals }) => (
    <Button {...args} loading loadingLabel={storyText(globals, { en: "Saving", es: "Guardando" })}>
      {storyText(globals, { en: "Save", es: "Guardar" })}
    </Button>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args, { globals }) => (
    <Button {...args}>{storyText(globals, { en: "Create a household", es: "Crear un hogar" })}</Button>
  ),
};
