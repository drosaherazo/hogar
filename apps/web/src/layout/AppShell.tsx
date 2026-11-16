import clsx from "clsx";
import { House, ReceiptText } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { useCurrentUser } from "../auth/guards";
import { useHousehold } from "../household/useHousehold";
import { IosInstallSheet } from "../install/IosInstallSheet";
import { useInstallPrompt } from "../install/installPrompt";
import { UpdateNotice } from "../update/UpdateNotice";
import { AppHeader } from "./AppHeader";
import styles from "./AppShell.module.css";

/**
 * Frame of every signed-in page: skip link, header with the account menu, the main navigation
 * (once there's a household to navigate) and the main column.
 *
 * Why the navigation moves: most people use Hogar on a phone, often one-handed in a kitchen or a
 * supermarket, so below 48rem it is a tab bar fixed to the bottom, always in thumb reach and still
 * there after scrolling. Installed, Hogar has no browser chrome either, so the tab bar is how
 * people get around. From 48rem up the same links sit in the header next to the brand, so a desktop
 * doesn't look like a stretched phone. It is one `<nav>` in the header at every size (the tab bar
 * is the same element, fixed by CSS), so screen readers announce a single main navigation.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const { logout } = useAuth();
  const household = useHousehold();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const install = useInstallPrompt();
  const [iosSteps, setIosSteps] = useState(false);
  const hasNavigation = Boolean(household.data?.household);
  const navClass = ({ isActive }: { isActive: boolean }) => clsx(styles.navLink, isActive && styles.current);
  // Balances belong to the money section too, so "Expenses" stays marked there.
  const inMoney = pathname.startsWith("/expenses") || pathname.startsWith("/balances");

  const navigation = hasNavigation && (
    <nav aria-label={t("nav.label")} className={styles.nav}>
      <NavLink to="/" end className={navClass}>
        <House className={styles.navIcon} aria-hidden="true" />
        <span className={styles.navLabel}>{t("nav.home")}</span>
      </NavLink>
      <Link
        to="/expenses"
        className={clsx(styles.navLink, inMoney && styles.current)}
        aria-current={pathname === "/expenses" ? "page" : inMoney ? "true" : undefined}
      >
        <ReceiptText className={styles.navIcon} aria-hidden="true" />
        <span className={styles.navLabel}>{t("nav.expenses")}</span>
      </Link>
    </nav>
  );

  return (
    <div className={clsx(styles.page, hasNavigation && styles.withTabBar)}>
      <a href="#main" className={styles.skipLink}>
        {t("skipToContent")}
      </a>
      <AppHeader
        user={user}
        navigation={navigation}
        onOpenSettings={hasNavigation ? () => void navigate("/household/settings") : undefined}
        onInstall={
          install.way === "none"
            ? undefined
            : () => (install.way === "native" ? void install.promptNative() : setIosSteps(true))
        }
        onSignOut={() => void logout()}
      />
      <IosInstallSheet open={iosSteps} onOpenChange={setIosSteps} />
      <main id="main" className={styles.main} tabIndex={-1}>
        <UpdateNotice />
        {children}
      </main>
    </div>
  );
}
