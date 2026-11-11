import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import { useCurrentUser } from "../auth/guards";
import { AppHeader } from "./AppHeader";
import styles from "./AppShell.module.css";

/** Frame of every signed-in page: skip link, header with the account menu, and the main column. */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const { logout } = useAuth();

  return (
    <div className={styles.page}>
      <a href="#main" className={styles.skipLink}>
        {t("skipToContent")}
      </a>
      <AppHeader user={user} onSignOut={() => void logout()} />
      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
