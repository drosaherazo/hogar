import type { Meta, StoryObj } from "@storybook/react-vite";
import { storyText } from "../../docs/blocks/storyLocale";
import { Button } from "../Button/Button";
import { Alert } from "./Alert";

const meta = {
  title: "Components/Alert",
  component: Alert,
  args: { tone: "info", children: "" },
  argTypes: { tone: { control: "inline-radio", options: ["info", "warning", "danger"] } },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  render: (args, { globals }) => (
    <Alert {...args} tone="info">
      {storyText(globals, {
        en: "You're no longer part of Casa Ana. You can create a new household or join one with an invitation.",
        es: "Ya no formas parte de Casa Ana. Puedes crear un hogar nuevo o unirte a uno con una invitación.",
      })}
    </Alert>
  ),
};

export const Warning: Story = {
  render: (args, { globals }) => (
    <Alert
      {...args}
      tone="warning"
      title={storyText(globals, { en: "Review the split", es: "Revisad el reparto" })}
      action={
        <Button size="sm" variant="secondary">
          {storyText(globals, { en: "Review split", es: "Revisar reparto" })}
        </Button>
      }
    >
      {storyText(globals, {
        en: "Someone joined or left since the split was last saved.",
        es: "Alguien ha entrado o salido desde que se guardó el reparto.",
      })}
    </Alert>
  ),
};

export const Danger: Story = {
  render: (args, { globals }) => (
    <Alert {...args} tone="danger">
      {storyText(globals, {
        en: "This invitation has expired. Ask the person who invited you for a new link.",
        es: "Esta invitación ha caducado. Pide un enlace nuevo a quien te invitó.",
      })}
    </Alert>
  ),
};
