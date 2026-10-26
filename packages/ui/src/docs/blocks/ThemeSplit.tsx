import { Unstyled } from "@storybook/addon-docs/blocks";
import type { ReactNode } from "react";
import styles from "./blocks.module.css";
import { useLocalized, type Localized } from "./locale";

export type ThemeName = "light" | "dark";

const LABELS: Localized<Record<ThemeName, string>> = {
  en: { light: "Light theme", dark: "Dark theme" },
  es: { light: "Tema claro", dark: "Tema oscuro" },
};

const THEMES: ThemeName[] = ["light", "dark"];

/**
 * Renders the same content in the light and dark themes, side by side.
 * `Unstyled` opts the panels out of Storybook's docs typography, which forces the
 * page theme's text and code colors and would break contrast in the opposite panel.
 * Inside, only our semantic tokens apply, resolved by each panel's `data-theme`.
 */
export function ThemeSplit({ children }: { children: (theme: ThemeName) => ReactNode }) {
  const labels = useLocalized(LABELS);
  return (
    <Unstyled className={styles.split}>
      {THEMES.map((name) => (
        <section key={name} data-theme={name} className={styles.panel} aria-label={labels[name]}>
          <p className={styles.panelTitle}>{labels[name]}</p>
          {children(name)}
        </section>
      ))}
    </Unstyled>
  );
}
