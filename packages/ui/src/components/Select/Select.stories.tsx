import type { Meta, StoryObj } from "@storybook/react-vite";
import { storyText } from "../../docs/blocks/storyLocale";
import { Select } from "./Select";

const people = [
  { value: "ana", label: "Ana García" },
  { value: "bruno", label: "Bruno Díaz" },
  { value: "carla", label: "Carla Ruiz" },
];

const meta = {
  title: "Components/Select",
  component: Select,
  args: { label: "", options: people, disabled: false },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args, { globals }) => (
    <Select
      {...args}
      label={storyText(globals, { en: "Who paid?", es: "¿Quién pagó?" })}
      hint={storyText(globals, { en: "Anyone in the household.", es: "Cualquier persona del hogar." })}
      defaultValue="ana"
    />
  ),
};

export const WithError: Story = {
  render: (args, { globals }) => (
    <Select
      {...args}
      label={storyText(globals, { en: "Who received it?", es: "¿Quién lo recibió?" })}
      error={storyText(globals, { en: "Choose two different people.", es: "Elige a dos personas distintas." })}
      defaultValue="ana"
    />
  ),
};
