import clsx from "clsx";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { useCurrentUser } from "../auth/guards";
import { useHousehold } from "../household/useHousehold";
import { AppHeader } from "./AppHeader";
import styles from "./AppShell.module.css";

/**
 * Frame of every signed-in page: skip link, header with the account menu, the main navigation
 * (once there's a household to navigate) and the main column.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const { logout } = useAuth();
  const household = useHousehold();
  const navClass = ({ isActive }: { isActive: boolean }) => clsx(styles.navLink, isActive && styles.current);

  return (
    <div className={styles.page}>
      <a href="#main" className={styles.skipLink}>
        {t("skipToContent")}
      </a>
      <AppHeader user={user} onSignOut={() => void logout()} />
      {household.data?.household && (
        <nav aria-label={t("nav.label")} className={styles.nav}>
          <NavLink to="/" end className={navClass}>
            {t("nav.home")}
          </NavLink>
          <NavLink to="/expenses" className={navClass}>
            {t("nav.expenses")}
          </NavLink>
        </nav>
      )}
      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
