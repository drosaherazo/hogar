import type { Meta, StoryObj } from "@storybook/react-vite";
import { storyText } from "../../docs/blocks/storyLocale";
import { Button } from "../Button/Button";
import { WakeUpScreen } from "./WakeUpScreen";

const meta = {
  title: "Components/WakeUpScreen",
  component: WakeUpScreen,
  args: { status: "", mood: "waking" },
  argTypes: { mood: { control: "inline-radio", options: ["waking", "resting"] } },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WakeUpScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Waking: Story = {
  render: (args, { globals }) => (
    <WakeUpScreen
      {...args}
      status={storyText(globals, { en: "Knocking on your home's door…", es: "Llamando a la puerta de tu hogar…" })}
      description={storyText(globals, {
        en: "Hogar takes a nap when nobody's around, so waking up can take up to a minute. Thanks for waiting!",
        es: "Hogar se echa la siesta cuando no hay nadie, así que despertarse puede llevar hasta un minuto. ¡Gracias por esperar!",
      })}
      tipLabel={storyText(globals, { en: "Quick tip", es: "Un consejo" })}
      tip={storyText(globals, {
        en: "Invite the people you live with by sharing a link. No emails needed.",
        es: "Invita a quien vive contigo compartiendo un enlace. Sin emails de por medio.",
      })}
    />
  ),
};

/** The longest Spanish copy, to check the layout holds whatever the Locale toolbar says. */
export const WakingSpanish: Story = {
  args: {
    status: "Ya casi está, poniendo el agua a calentar…",
    description:
      "Hogar se echa la siesta cuando no hay nadie, así que despertarse puede llevar hasta un minuto. ¡Gracias por esperar!",
    tipLabel: "Un consejo",
    tip: "Las personas invitadas lo ven todo pero no cambian nada. Ideal para quien se queda una temporada.",
  },
};

export const Slow: Story = {
  args: { mood: "resting" },
  render: (args, { globals }) => (
    <WakeUpScreen
      {...args}
      status={storyText(globals, { en: "This is taking longer than usual", es: "Esto está tardando más de lo normal" })}
      description={storyText(globals, {
        en: "Your home may still be waking up. Give it another go in a moment.",
        es: "Puede que tu hogar siga despertándose. Vuelve a intentarlo en un momento.",
      })}
      action={<Button>{storyText(globals, { en: "Try again", es: "Intentarlo de nuevo" })}</Button>}
    />
  ),
};

export const Offline: Story = {
  args: { mood: "resting" },
  render: (args, { globals }) => (
    <WakeUpScreen
      {...args}
      status={storyText(globals, { en: "You seem to be offline", es: "Parece que no tienes conexión" })}
      description={storyText(globals, {
        en: "We'll carry on as soon as you're back online.",
        es: "Seguiremos en cuanto vuelvas a tener conexión.",
      })}
    />
  ),
};
