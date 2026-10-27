import { LOCALES } from "@hogar/shared";
import { Button } from "@hogar/ui";
import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LANGUAGE_NAMES, useLocalePreference } from "../i18n";
import { useTheme } from "../theme/theme";
import styles from "./PreferencesBar.module.css";

/** Language and theme switches for pages without the account menu (the login page). */
export function PreferencesBar() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocalePreference();
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <div className={styles.bar}>
      <div role="group" aria-label={t("language.label")} className={styles.languages}>
        {LOCALES.map((option) => (
          <Button
            key={option}
            variant="ghost"
            size="sm"
            lang={option}
            aria-pressed={locale === option}
            className={locale === option ? styles.active : undefined}
            onClick={() => setLocale(option)}
          >
            {LANGUAGE_NAMES[option]}
          </Button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={nextTheme === "dark" ? <Moon /> : <Sun />}
        onClick={() => setTheme(nextTheme)}
      >
        {nextTheme === "dark" ? t("theme.switchToDark") : t("theme.switchToLight")}
      </Button>
    </div>
  );
}
