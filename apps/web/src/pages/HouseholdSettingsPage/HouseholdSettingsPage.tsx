import type { HouseholdView } from "@hogar/shared";
import { Spinner } from "@hogar/ui";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { LoadError } from "../../household/LoadError";
import { useHousehold } from "../../household/useHousehold";
import { ActionLink } from "../../layout/ActionLink";
import { AppShell } from "../../layout/AppShell";
import styles from "./HouseholdSettingsPage.module.css";
import { InvitationsSection } from "./InvitationsSection";
import { NameSection } from "./NameSection";

/** Household settings: name, members (and invitations) and the split. */
export function HouseholdSettingsPage() {
  const { t } = useTranslation(["household", "common"]);
  const household = useHousehold();

  if (household.isSuccess && !household.data.household) return <Navigate to="/" replace />;

  return (
    <AppShell>
      <div className={styles.heading}>
        <ActionLink to="/" variant="ghost" icon={<ArrowLeft />} className={styles.back}>
          {t("settings.back")}
        </ActionLink>
        <h1 className={styles.title}>{t("settings.title")}</h1>
      </div>
      {household.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : household.isError ? (
        <LoadError error={household.error} onRetry={() => void household.refetch()} />
      ) : (
        household.data.household && <Sections household={household.data.household} />
      )}
    </AppShell>
  );
}

function Sections({ household }: { household: HouseholdView }) {
  const isAdmin = household.myRole === "ADMIN";
  return (
    <div className={styles.sections}>
      <NameSection household={household} />
      {isAdmin && <InvitationsSection />}
    </div>
  );
}
