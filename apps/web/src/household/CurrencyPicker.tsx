import { currencyCodeSchema, isRetired, OFFERED_CURRENCY_CODES, type CurrencyCode } from "@hogar/shared";
import { Combobox, useLocale, type ComboboxItem } from "@hogar/ui";
import { useMemo, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { createCurrencySearch } from "./currencySearch";

export interface CurrencyPickerProps {
  /** Visible label, already translated. */
  label: string;
  /** Guidance under the field, already translated. */
  hint: string;
  value: CurrencyCode;
  onChange: (code: CurrencyCode) => void;
  error?: string | undefined;
  inputRef?: Ref<HTMLInputElement> | undefined;
  /**
   * The household's own currency, when there is one: kept in the list even if it has since been
   * retired, so the field can still show it.
   */
  current?: CurrencyCode | undefined;
}

/**
 * The household currency field (ADR 0014): a `Combobox` over the currencies someone can choose,
 * never a retired one, found by name, ISO code or country in the active language, so nobody needs
 * to know codes or scroll through ~150 currencies.
 */
export function CurrencyPicker({ label, hint, value, onChange, error, inputRef, current }: CurrencyPickerProps) {
  const { t } = useTranslation("household");
  const locale = useLocale();
  const search = useMemo(() => {
    const codes = current && isRetired(current) ? [...OFFERED_CURRENCY_CODES, current] : OFFERED_CURRENCY_CODES;
    const find = createCurrencySearch(codes, locale);
    return (query: string): ComboboxItem[] =>
      find(query).map(({ code, name, country }) => ({
        id: code,
        label: name,
        tag: code,
        detail: country && t("currencyPicker.usedIn", { country }),
      }));
  }, [current, locale, t]);

  return (
    <Combobox
      inputRef={inputRef}
      label={label}
      hint={hint}
      search={search}
      selectedId={value}
      onSelectionChange={(id) => {
        const picked = currencyCodeSchema.safeParse(id);
        if (picked.success) onChange(picked.data);
      }}
      noResults={(query) => t("currencyPicker.noResults", { query })}
      triggerLabel={t("currencyPicker.showAll")}
      error={error}
    />
  );
}
