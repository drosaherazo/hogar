import { LOCALES, type AuthUser, type Locale } from "@hogar/shared";
import { Avatar, Menu, MenuItem, MenuRadioGroup, MenuSeparator } from "@hogar/ui";
import { Languages, LogOut, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LANGUAGE_NAMES, useLocalePreference } from "../i18n";
import { useTheme, type Theme } from "../theme/theme";
import styles from "./AppHeader.module.css";
import { HogarMark } from "./HogarMark";

export interface AppHeaderProps {
  user: AuthUser;
  onSignOut: () => void;
}

/** Top bar of the signed-in app: the brand and the account menu (theme, language, sign out). */
export function AppHeader({ user, onSignOut }: AppHeaderProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocalePreference();

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <HogarMark />
        <span className={styles.appName}>{t("appName")}</span>
      </div>
      <Menu
        trigger={
          <button type="button" className={styles.accountButton} aria-label={t("account.menu", { name: user.name })}>
            <Avatar name={user.name} src={user.avatarUrl} size="sm" decorative />
            <span className={styles.userName} aria-hidden="true">
              {user.name}
            </span>
          </button>
        }
      >
        <MenuRadioGroup<Theme>
          label={t("theme.label")}
          value={theme}
          onValueChange={setTheme}
          options={[
            { value: "light", label: t("theme.light"), icon: <Sun /> },
            { value: "dark", label: t("theme.dark"), icon: <Moon /> },
          ]}
        />
        <MenuSeparator />
        <MenuRadioGroup<Locale>
          label={t("language.label")}
          value={locale}
          onValueChange={(next) => setLocale(next)}
          options={LOCALES.map((option) => ({ value: option, label: LANGUAGE_NAMES[option], icon: <Languages /> }))}
        />
        <MenuSeparator />
        <MenuItem icon={<LogOut />} onSelect={onSignOut}>
          {t("account.signOut")}
        </MenuItem>
      </Menu>
    </header>
  );
}
