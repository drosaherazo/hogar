import type { Meta, StoryObj } from "@storybook/react-vite";
import { storyLocale, storyText } from "../../docs/blocks/storyLocale";
import { LocaleProvider } from "../../locale/LocaleProvider";
import { Amount, type AmountCurrency } from "./Amount";

const EUR: AmountCurrency = { code: "EUR", decimals: 2 };
const COP: AmountCurrency = { code: "COP", decimals: 0 };

const meta = {
  title: "Components/Amount",
  component: Amount,
  args: { units: 4280, currency: EUR },
  argTypes: { units: { control: { type: "number", min: 0, step: 1 } } },
} satisfies Meta<typeof Amount>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Follows the Locale toolbar: €42.80 in English, 42,80 € in Spanish. */
export const Default: Story = {};

/** Colombian pesos have no decimals in everyday use: COP 85,000 in English, 85.000 COP in Spanish. */
export const WholePesos: Story = { args: { units: 85_000, currency: COP } };

/**
 * The same pesos on a device in Colombia: the formatting locale adds the device region to the
 * language, so Spanish reads "$ 85.000", the way pesos are written there; English keeps "COP".
 */
export const WithDeviceRegion: Story = {
  args: { units: 85_000, currency: COP },
  render: (args, { globals }) => {
    const locale = storyLocale(globals);
    return (
      <LocaleProvider locale={locale} formattingLocale={`${locale}-CO`}>
        <Amount {...args} />
      </LocaleProvider>
    );
  },
};

export const InASentence: Story = {
  render: (args, { globals }) => (
    <p>
      {storyText(globals, { en: "Bruno owes you ", es: "Bruno te debe " })}
      <Amount {...args} units={1070} />
    </p>
  ),
};

export const LinedUp: Story = {
  render: (args, { globals }) => (
    <dl style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "var(--space-2) var(--space-6)", margin: 0 }}>
      {[
        [storyText(globals, { en: "Groceries", es: "Compra" }), 4280],
        [storyText(globals, { en: "Electricity", es: "Luz" }), 11119],
        [storyText(globals, { en: "Bread", es: "Pan" }), 135],
      ].map(([label, units]) => (
        <div key={String(label)} style={{ display: "contents" }}>
          <dt>{label}</dt>
          <dd style={{ margin: 0, textAlign: "end" }}>
            <Amount units={Number(units)} currency={args.currency} />
          </dd>
        </div>
      ))}
    </dl>
  ),
};
