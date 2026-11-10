import type { Meta, StoryObj } from "@storybook/react-vite";
import { storyText } from "../../docs/blocks/storyLocale";
import { TextField } from "./TextField";

const meta = {
  title: "Components/TextField",
  component: TextField,
  args: { label: "", disabled: false },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args, { globals }) => (
    <TextField
      {...args}
      label={storyText(globals, { en: "Household name", es: "Nombre del hogar" })}
      hint={storyText(globals, { en: "You can change it later.", es: "Puedes cambiarlo más adelante." })}
      placeholder={storyText(globals, { en: "Casa Ana", es: "Casa Ana" })}
    />
  ),
};

export const WithError: Story = {
  render: (args, { globals }) => (
    <TextField
      {...args}
      label={storyText(globals, { en: "Household name", es: "Nombre del hogar" })}
      error={storyText(globals, { en: "Give your household a name.", es: "Ponle un nombre a tu hogar." })}
      defaultValue=""
    />
  ),
};

export const InlineNumber: Story = {
  render: (args, { globals }) => (
    <div style={{ display: "grid", gap: "var(--space-3)", maxInlineSize: "var(--size-content-sm)" }}>
      <TextField
        {...args}
        inline
        type="number"
        min={0}
        max={100}
        defaultValue={3}
        label={storyText(globals, { en: "Ana García · 75 %", es: "Ana García · 75 %" })}
      />
      <TextField
        {...args}
        inline
        type="number"
        min={0}
        max={100}
        defaultValue={1}
        label={storyText(globals, { en: "Bruno Díaz · 25 %", es: "Bruno Díaz · 25 %" })}
      />
    </div>
  ),
};
