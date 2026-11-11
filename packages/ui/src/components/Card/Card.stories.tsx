import type { Meta, StoryObj } from "@storybook/react-vite";
import { storyText } from "../../docs/blocks/storyLocale";
import { Button } from "../Button/Button";
import { Card } from "./Card";

const meta = {
  title: "Components/Card",
  component: Card,
  args: { padding: "md", elevated: false, as: "div" },
  argTypes: {
    padding: { control: "inline-radio", options: ["md", "lg"] },
    as: { control: "inline-radio", options: ["div", "section", "article"] },
    tone: { control: "inline-radio", options: ["default", "brand"] },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderCard: Story["render"] = (args, { globals }) => (
  <Card {...args}>
    <p style={{ margin: 0 }}>
      {storyText(globals, {
        en: "Saturday groceries · Paid by Ana",
        es: "Compra del sábado · Pagado por Ana",
      })}
    </p>
  </Card>
);

export const Default: Story = { render: renderCard };

export const Elevated: Story = {
  args: { elevated: true, padding: "lg" },
  render: renderCard,
};

/** The one highlighted card per screen: everything inside adapts to the brand color. */
export const Brand: Story = {
  args: { tone: "brand", padding: "lg", as: "section" },
  render: (args, { globals }) => (
    <Card {...args} aria-labelledby="brand-card-title">
      <h2 id="brand-card-title" style={{ margin: 0, fontSize: "var(--font-size-xl)" }}>
        {storyText(globals, { en: "Money", es: "Dinero" })}
      </h2>
      <p style={{ margin: "var(--space-4) 0", fontSize: "var(--font-size-lg)" }}>
        {storyText(globals, { en: "You're owed €10.70 in total", es: "Te deben 10,70 € en total" })}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <Button>{storyText(globals, { en: "Add expense", es: "Añadir gasto" })}</Button>
        <Button variant="secondary">{storyText(globals, { en: "See balances", es: "Ver saldos" })}</Button>
      </div>
    </Card>
  ),
};
