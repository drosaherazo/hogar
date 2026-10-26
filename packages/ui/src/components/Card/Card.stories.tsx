import type { Meta, StoryObj } from "@storybook/react-vite";
import { storyText } from "../../docs/blocks/storyLocale";
import { Card } from "./Card";

const meta = {
  title: "Components/Card",
  component: Card,
  args: { padding: "md", elevated: false, as: "div" },
  argTypes: {
    padding: { control: "inline-radio", options: ["md", "lg"] },
    as: { control: "inline-radio", options: ["div", "section", "article"] },
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
