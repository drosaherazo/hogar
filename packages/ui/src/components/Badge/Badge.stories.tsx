import type { Meta, StoryObj } from "@storybook/react-vite";
import { storyText } from "../../docs/blocks/storyLocale";
import { Badge } from "./Badge";

const meta = {
  title: "Components/Badge",
  component: Badge,
  args: { tone: "neutral" },
  argTypes: { tone: { control: "inline-radio", options: ["neutral", "positive", "negative", "warning"] } },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {
  render: (args, { globals }) => (
    <Badge {...args}>{storyText(globals, { en: "Coming soon", es: "Próximamente" })}</Badge>
  ),
};

export const Tones: Story = {
  render: (_, { globals }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
      <Badge>{storyText(globals, { en: "Coming soon", es: "Próximamente" })}</Badge>
      <Badge tone="positive">{storyText(globals, { en: "Done", es: "Hecho" })}</Badge>
      <Badge tone="negative">{storyText(globals, { en: "You owe", es: "Debes" })}</Badge>
      <Badge tone="warning">{storyText(globals, { en: "Due tomorrow", es: "Vence mañana" })}</Badge>
    </div>
  ),
};
