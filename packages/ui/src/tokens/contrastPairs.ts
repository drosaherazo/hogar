import type { Locale } from "../locale/LocaleProvider";
import { AA_TEXT, AA_UI } from "./contrast";

export interface ContrastPair {
  foreground: string;
  background: string;
  minimum: number;
  /** Where the pair is used, in every locale (shown in the Storybook contrast table). */
  usage: Record<Locale, string>;
}

const pair = (foreground: string, background: string, minimum: number, en: string, es: string): ContrastPair => ({
  foreground,
  background,
  minimum,
  usage: { en, es },
});

/** Semantic token pairs used by the interface that must meet AA in both themes. */
export const contrastPairs: ContrastPair[] = [
  pair("--color-text", "--color-bg", AA_TEXT, "Body text", "Texto principal"),
  pair("--color-text", "--color-surface", AA_TEXT, "Text on cards", "Texto en tarjetas"),
  pair("--color-text-muted", "--color-bg", AA_TEXT, "Secondary text", "Texto secundario"),
  pair("--color-text-muted", "--color-surface", AA_TEXT, "Secondary text on cards", "Texto secundario en tarjetas"),
  pair("--color-text-muted", "--color-surface-sunken", AA_TEXT, "Secondary text on sunken areas", "Texto secundario en zonas hundidas"),
  pair("--color-accent-contrast", "--color-accent", AA_TEXT, "Primary button label", "Texto del botón principal"),
  pair("--color-accent-contrast", "--color-accent-hover", AA_TEXT, "Primary button on hover", "Botón principal al pasar el ratón"),
  pair("--color-accent-text", "--color-surface", AA_TEXT, "Links and accent text", "Enlaces y texto de acento"),
  pair("--color-positive", "--color-surface", AA_TEXT, "Amount owed to you", "Importe a tu favor"),
  pair("--color-positive", "--color-positive-bg", AA_TEXT, "Positive notice", "Aviso positivo"),
  pair("--color-negative", "--color-surface", AA_TEXT, "Amount you owe", "Importe que debes"),
  pair("--color-negative", "--color-negative-bg", AA_TEXT, "Error message", "Mensaje de error"),
  pair("--color-warning", "--color-surface", AA_TEXT, "Warning text", "Texto de aviso"),
  pair("--color-warning", "--color-warning-bg", AA_TEXT, "Warning box", "Caja de aviso"),
  pair("--color-border-strong", "--color-surface", AA_UI, "Form field border", "Borde de campos de formulario"),
  pair("--color-focus", "--color-bg", AA_UI, "Focus ring", "Anillo de foco"),
  pair("--color-selection-text", "--color-selection-bg", AA_TEXT, "Selected text", "Texto seleccionado"),
  ...Array.from({ length: 8 }, (_, index) =>
    pair(
      "--color-member-text",
      `--color-member-${index + 1}`,
      AA_TEXT,
      `Initials on member color ${index + 1}`,
      `Iniciales sobre el color de miembro ${index + 1}`,
    ),
  ),
];
