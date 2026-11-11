import { canEditContent, type HouseholdView } from "@hogar/shared";
import { Alert, Avatar, Button, Card, EmptyState, Spinner } from "@hogar/ui";
import { ArrowDownLeft, ArrowUpRight, House, Plus, Settings } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "../../auth/guards";
import { useBalanceSentence } from "../../expenses/BalanceSentence";
import { useBalances } from "../../expenses/useExpenses";
import { CreateHouseholdDialog } from "../../household/CreateHouseholdDialog";
import { LoadError } from "../../household/LoadError";
import { memberColor } from "../../household/members";
import { useDismissRemovalNotice, useHousehold } from "../../household/useHousehold";
import { ActionLink } from "../../layout/ActionLink";
import { AppShell } from "../../layout/AppShell";
import styles from "./HomePage.module.css";

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Home for signed-in people: their household, or how to get one. */
export function HomePage() {
  const { t } = useTranslation(["home", "common"]);
  const user = useCurrentUser();
  const household = useHousehold();

  return (
    <AppShell>
      <div className={styles.welcome}>
        <h1 className={styles.greeting}>{t("greeting", { name: firstName(user.name) })}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
      </div>
      {household.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : household.isError ? (
        <LoadError error={household.error} onRetry={() => void household.refetch()} />
      ) : household.data.household ? (
        <HouseholdSummary household={household.data.household} />
      ) : (
        <NoHousehold removedFrom={household.data.removedFrom} />
      )}
    </AppShell>
  );
}

function NoHousehold({ removedFrom }: { removedFrom: string | null }) {
  const { t } = useTranslation(["home", "household"]);
  const [creating, setCreating] = useState(false);
  // Keep the note for this visit even if a refetch comes back without it.
  const [removalNote] = useState(removedFrom);
  const { mutate: dismissNote } = useDismissRemovalNotice();

  // The note is shown once: as soon as it's on screen, the server forgets it.
  const dismissed = useRef(false);
  useEffect(() => {
    if (removalNote && !dismissed.current) {
      dismissed.current = true;
      dismissNote();
    }
  }, [removalNote, dismissNote]);

  return (
    <>
      {removalNote && <Alert tone="info">{t("household:home.removed", { name: removalNote })}</Alert>}
      <Card padding="lg">
        <EmptyState
          icon={<House />}
          title={t("noHousehold.title")}
          description={t("noHousehold.description")}
          actions={
            <Button icon={<Plus />} onClick={() => setCreating(true)}>
              {t("noHousehold.create")}
            </Button>
          }
        />
        <p className={styles.joinHint}>{t("noHousehold.joinHint")}</p>
      </Card>
      <CreateHouseholdDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function HouseholdSummary({ household }: { household: HouseholdView }) {
  const { t } = useTranslation("household");
  const isAdmin = household.myRole === "ADMIN";

  return (
    <>
      {isAdmin && household.splitNeedsReview && (
        <Alert
          tone="warning"
          title={t("home.reviewSplit.title")}
          action={<ActionLink to="/household/settings#split">{t("home.reviewSplit.action")}</ActionLink>}
        >
          {t("home.reviewSplit.description")}
        </Alert>
      )}
      <Card as="section" padding="lg" aria-labelledby="household-name" className={styles.household}>
        <div className={styles.householdHeader}>
          <h2 id="household-name" className={styles.householdName}>
            {household.name}
          </h2>
          <p className={styles.people}>{t("home.people", { count: household.members.length })}</p>
        </div>
        <ul className={styles.members}>
          {household.members.map((member, index) => (
            <li key={member.id} className={styles.member}>
              <Avatar name={member.name} src={member.avatarUrl} colorIndex={memberColor(index)} decorative />
              <span>{member.name}</span>
            </li>
          ))}
        </ul>
        <ActionLink to="/household/settings" icon={<Settings />} className={styles.settingsLink}>
          {t("home.settingsLink")}
        </ActionLink>
      </Card>
      <MoneyCard canEdit={canEditContent(household.myRole)} />
    </>
  );
}

/** Where the person stands with money, and the ways into expenses and balances. */
/**
 * Where the person stands, in words. On the fuchsia card the positive and negative colors
 * wouldn't read, so a small arrow echoes the sentence instead: in when owed, out when owing.
 * It's decorative; the words already say everything.
 */
function MyBalance({ cents }: { cents: number }) {
  const sentence = useBalanceSentence();
  const Arrow = cents > 0 ? ArrowDownLeft : cents < 0 ? ArrowUpRight : null;
  return (
    <p className={styles.balance}>
      {Arrow && (
        <span className={styles.direction} aria-hidden="true" data-direction={cents > 0 ? "in" : "out"}>
          <Arrow />
        </span>
      )}
      <span>{sentence(cents)}</span>
    </p>
  );
}

function MoneyCard({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation(["expenses", "common"]);
  const balances = useBalances();
  const titleId = useId();

  return (
    <Card as="section" padding="lg" tone="brand" aria-labelledby={titleId} className={styles.money}>
      <h2 id={titleId} className={styles.moneyTitle}>
        {t("home.title")}
      </h2>
      {balances.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : balances.isError ? (
        <p className={styles.people}>{t("balances.loadError")}</p>
      ) : (
        <MyBalance cents={balances.data.myBalanceCents} />
      )}
      <div className={styles.moneyActions}>
        {canEdit && (
          <ActionLink to="/expenses/new" variant="primary" icon={<Plus />}>
            {t("add")}
          </ActionLink>
        )}
        <ActionLink to="/expenses">{t("home.seeExpenses")}</ActionLink>
        <ActionLink to="/balances">{t("balances.link")}</ActionLink>
      </div>
    </Card>
  );
}
