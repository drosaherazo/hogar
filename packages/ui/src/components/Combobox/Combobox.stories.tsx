import type { Meta, StoryObj } from "@storybook/react-vite";
import { useCallback, useEffect, useState } from "react";
import { storyLocale, storyText } from "../../docs/blocks/storyLocale";
import { TextField } from "../TextField/TextField";
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

/** Things a household bought before, how many times, and the note of the latest purchase. */
const BOUGHT = [
  { id: "milk", en: "Milk", es: "Leche", times: 9, note: { en: "Lactose-free", es: "Sin lactosa" } },
  { id: "bread", en: "Bread", es: "Pan", times: 7, note: null },
  { id: "eggs", en: "Eggs", es: "Huevos", times: 5, note: { en: "A dozen", es: "Una docena" } },
  { id: "lettuce", en: "Lettuce", es: "Lechuga", times: 4, note: null },
  { id: "oat-milk", en: "Oat milk", es: "Bebida de avena", times: 2, note: null },
] as const;

/**
 * Free text with suggestions, like a shopping item's name. They arrive a moment after the typing,
 * as a server's would; picking one fills the name and its last note, and both stay editable.
 */
function ItemName({ locale }: { locale: "en" | "es" }) {
  const copy = (text: { en: string; es: string }) => storyText({ locale }, text);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ComboboxItem[]>([]);
  useEffect(() => {
    const wanted = fold(name.trim());
    const timer = setTimeout(() => {
      const found = BOUGHT.filter((item) => wanted !== "" && fold(item[locale]).includes(wanted));
      setItems(
        found.map((item) => ({
          id: item.id,
          label: item[locale],
          detail: storyText({ locale }, { en: `Bought ${item.times} times`, es: `Comprado ${item.times} veces` }),
        })),
      );
    }, 150);
    return () => clearTimeout(timer);
  }, [name, locale]);
  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <Combobox
        allowsCustomValue
        label={copy({ en: "What's needed?", es: "¿Qué hace falta?" })}
        inputValue={name}
        onInputChange={setName}
        items={items}
        onSelectionChange={(id) => setNote(BOUGHT.find((item) => item.id === id)?.note?.[locale] ?? "")}
        enterKeyHint="done"
      />
      <TextField
        label={copy({ en: "Note (optional)", es: "Nota (opcional)" })}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
    </div>
  );
}

// Every story renders its own example with state, so there are no args to control. The two kinds
// of props (one option from a list, or free text with suggestions) are a union Storybook can't infer.
const meta: Meta<typeof Combobox> = {
  title: "Components/Combobox",
  component: Combobox,
  parameters: { controls: { disable: true } },
};

export default meta;
type Story = StoryObj;

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

/** Type "mil" or "lec": suggestions from what the household bought, most bought first. Anything else is fine too. */
export const FreeText: Story = {
  render: (_, { globals }) => <ItemName locale={storyLocale(globals)} />,
};
