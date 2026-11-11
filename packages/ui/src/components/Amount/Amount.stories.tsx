import type { Meta, StoryObj } from "@storybook/react-vite";
import { storyText } from "../../docs/blocks/storyLocale";
import { Amount } from "./Amount";

const meta = {
  title: "Components/Amount",
  component: Amount,
  args: { cents: 4280 },
  argTypes: { cents: { control: { type: "number", min: 0, step: 1 } } },
} satisfies Meta<typeof Amount>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Follows the Locale toolbar: €42.80 in English, 42,80 € in Spanish. */
export const Default: Story = {};

export const InASentence: Story = {
  render: (args, { globals }) => (
    <p>
      {storyText(globals, { en: "Bruno owes you ", es: "Bruno te debe " })}
      <Amount {...args} cents={1070} />
    </p>
  ),
};

export const LinedUp: Story = {
  render: (_, { globals }) => (
    <dl style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "var(--space-2) var(--space-6)", margin: 0 }}>
      {[
        [storyText(globals, { en: "Groceries", es: "Compra" }), 4280],
        [storyText(globals, { en: "Electricity", es: "Luz" }), 11119],
        [storyText(globals, { en: "Bread", es: "Pan" }), 135],
      ].map(([label, cents]) => (
        <div key={String(label)} style={{ display: "contents" }}>
          <dt>{label}</dt>
          <dd style={{ margin: 0, textAlign: "end" }}>
            <Amount cents={Number(cents)} />
          </dd>
        </div>
      ))}
    </dl>
  ),
};
