import { Badge, Button, Card, EmptyState } from "@hogar/ui";
import { House, Plus, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/AuthProvider";
import { useCurrentUser } from "../../auth/guards";
import { AppHeader } from "../../layout/AppHeader";
import styles from "./HomePage.module.css";

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Home for signed-in people. Until households exist, it welcomes them and explains what comes next. */
export function HomePage() {
  const { t } = useTranslation(["home", "common"]);
  const user = useCurrentUser();
  const { logout } = useAuth();

  return (
    <div className={styles.page}>
      <a href="#main" className={styles.skipLink}>
        {t("common:skipToContent")}
      </a>
      <AppHeader user={user} onSignOut={() => void logout()} />
      <main id="main" className={styles.main}>
        <div className={styles.welcome}>
          <h1 className={styles.greeting}>{t("greeting", { name: firstName(user.name) })}</h1>
          <p className={styles.subtitle}>{t("subtitle")}</p>
        </div>
        <Card padding="lg">
          <EmptyState
            icon={<House />}
            title={t("noHousehold.title")}
            description={t("noHousehold.description")}
            actions={
              <>
                <Button icon={<Plus />} disabled>
                  {t("noHousehold.create")}
                </Button>
                <Button variant="secondary" icon={<UserPlus />} disabled>
                  {t("noHousehold.join")}
                </Button>
                <Badge>{t("noHousehold.comingSoon")}</Badge>
              </>
            }
          />
        </Card>
      </main>
    </div>
  );
}
