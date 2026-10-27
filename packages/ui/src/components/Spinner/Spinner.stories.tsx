import type { Meta, StoryObj } from "@storybook/react-vite";
import { storyText } from "../../docs/blocks/storyLocale";
import { Spinner } from "./Spinner";

const meta = {
  title: "Components/Spinner",
  component: Spinner,
  args: { label: "Loading", size: "md" },
  argTypes: { size: { control: "inline-radio", options: ["md", "lg"] } },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args, { globals }) => (
    <Spinner {...args} label={storyText(globals, { en: "Loading your home", es: "Cargando tu hogar" })} />
  ),
};

export const Large: Story = {
  args: { size: "lg" },
  render: (args, { globals }) => (
    <Spinner {...args} label={storyText(globals, { en: "Loading your home", es: "Cargando tu hogar" })} />
  ),
};
