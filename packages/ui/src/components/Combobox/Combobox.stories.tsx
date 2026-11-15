import type { Meta, StoryObj } from "@storybook/react-vite";
import { useCallback, useState } from "react";
import { storyLocale, storyText } from "../../docs/blocks/storyLocale";
import { Combobox, type ComboboxItem } from "./Combobox";

/**
 * A handful of currencies with a country each, matched like the app does: by name, code or
 * country, ignoring case and accents. The real list (about 150) comes from the app.
 */
const CURRENCIES = [
  { id: "EUR", country: "ES" },
  { id: "USD", country: "EC" },
  { id: "COP", country: "CO" },
  { id: "JPY", country: "JP" },
  { id: "KWD", country: "KW" },
  { id: "MXN", country: "MX" },
  { id: "GBP", country: "GB" },
  { id: "INR", country: "IN" },
] as const;

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function useCurrencySearch(locale: string) {
  return useCallback(
    (query: string): ComboboxItem[] => {
      const currencyNames = new Intl.DisplayNames(locale, { type: "currency" });
      const regionNames = new Intl.DisplayNames(locale, { type: "region" });
      const wanted = fold(query.trim());
      return CURRENCIES.map(({ id, country }) => ({
        id,
        label: currencyNames.of(id) ?? id,
        country: regionNames.of(country) ?? country,
      }))
        .sort((a, b) => a.label.localeCompare(b.label, locale))
        .flatMap(({ id, label, country }) => {
          if (fold(`${label} ${id}`).includes(wanted)) return [{ id, label, tag: id }];
          if (fold(country).includes(wanted)) {
            return [
              {
                id,
                label,
                tag: id,
                detail: storyText({ locale }, { en: `Used in ${country}`, es: `Se usa en ${country}` }),
              },
            ];
          }
          return [];
        });
    },
    [locale],
  );
}

function CurrencyPicker({ locale, error }: { locale: "en" | "es"; error?: string }) {
  const [value, setValue] = useState("EUR");
  const search = useCurrencySearch(locale);
  const copy = (text: { en: string; es: string }) => storyText({ locale }, text);
  return (
    <Combobox
      label={copy({ en: "Currency", es: "Moneda" })}
      hint={copy({
        en: "Search by name, code (like USD) or country.",
        es: "Busca por nombre, código (como USD) o país.",
      })}
      error={error}
      search={search}
      selectedId={value}
      onSelectionChange={setValue}
      noResults={(query) =>
        copy({
          en: `No currency matches “${query}”. Try its name, its code or a country.`,
          es: `Ninguna moneda coincide con «${query}». Prueba con su nombre, su código o un país.`,
        })
      }
      triggerLabel={copy({ en: "Show all currencies", es: "Mostrar todas las monedas" })}
    />
  );
}

const meta = {
  title: "Components/Combobox",
  component: Combobox,
  args: {
    label: "",
    search: () => [],
    selectedId: "EUR",
    onSelectionChange: () => {},
    noResults: () => "",
    triggerLabel: "",
  },
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Type "yen", "kwd" or a country such as "Japan" / "Japón": the list narrows as you type. */
export const Default: Story = {
  render: (_, { globals }) => <CurrencyPicker locale={storyLocale(globals)} />,
};

export const WithError: Story = {
  render: (_, { globals }) => (
    <CurrencyPicker
      locale={storyLocale(globals)}
      error={storyText(globals, { en: "Choose a currency from the list.", es: "Elige una moneda de la lista." })}
    />
  ),
};
