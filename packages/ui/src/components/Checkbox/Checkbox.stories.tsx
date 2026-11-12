import type { Meta, StoryObj } from "@storybook/react-vite";
import { storyText } from "../../docs/blocks/storyLocale";
import { Checkbox } from "./Checkbox";

const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  args: { label: "", disabled: false },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

const label = { en: "Use its own split", es: "Usar un reparto propio" };

export const Default: Story = {
  render: (args, { globals }) => <Checkbox {...args} label={storyText(globals, label)} />,
};

export const Checked: Story = {
  render: (args, { globals }) => <Checkbox {...args} defaultChecked label={storyText(globals, label)} />,
};

export const WithHint: Story = {
  render: (args, { globals }) => (
    <Checkbox
      {...args}
      label={storyText(globals, label)}
      hint={storyText(globals, {
        en: "If unticked, it follows the household's split.",
        es: "Si no la marcas, sigue el reparto de la casa.",
      })}
    />
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args, { globals }) => <Checkbox {...args} label={storyText(globals, label)} />,
};
