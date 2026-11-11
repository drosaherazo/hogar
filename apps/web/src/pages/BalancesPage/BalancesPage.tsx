import type { HouseholdView, PersonBalance, SuggestedSettlement } from "@hogar/shared";
import { Avatar, Card, EmptyState, Spinner } from "@hogar/ui";
import clsx from "clsx";
import { ArrowLeft, HandCoins, Scale } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { useCurrentUser } from "../../auth/guards";
import { useBalanceSentence } from "../../expenses/BalanceSentence";
import { avatarPropsFor } from "../../expenses/people";
import { useBalances } from "../../expenses/useExpenses";
import { LoadError } from "../../household/LoadError";
import { useHousehold } from "../../household/useHousehold";
import { useMoney } from "../../i18n/format";
import { ActionLink } from "../../layout/ActionLink";
import { AppShell } from "../../layout/AppShell";
import styles from "./BalancesPage.module.css";

/** Where everyone stands, in words, and the payments that would settle it. */
export function BalancesPage() {
  const { t } = useTranslation(["expenses", "common"]);
  const household = useHousehold();

  if (household.isSuccess && !household.data.household) return <Navigate to="/" replace />;
  const current = household.data?.household;

  return (
    <AppShell>
      <div className={styles.heading}>
        <ActionLink to="/expenses" variant="ghost" icon={<ArrowLeft />} className={styles.back}>
          {t("balances.back")}
        </ActionLink>
        <h1 className={styles.title}>{t("balances.title")}</h1>
      </div>
      {household.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : household.isError ? (
        <LoadError error={household.error} onRetry={() => void household.refetch()} />
      ) : (
        current && <Balances household={current} />
      )}
    </AppShell>
  );
}

function Balances({ household }: { household: HouseholdView }) {
  const { t } = useTranslation(["expenses", "common"]);
  const balances = useBalances();
  const everyoneId = useId();
  const suggestionsId = useId();

  if (balances.isPending) return <Spinner label={t("common:loading")} />;
  if (balances.isError) {
    return <LoadError title={t("balances.loadError")} error={balances.error} onRetry={() => void balances.refetch()} />;
  }

  const view = balances.data;
  if (view.balances.every((entry) => entry.balanceCents === 0)) {
    return (
      <Card padding="lg">
        <EmptyState icon={<Scale />} title={t("balances.allSquare")} description={t("balances.allSquareDescription")} />
      </Card>
    );
  }

  return (
    <>
      <Card as="section" padding="lg" aria-labelledby={everyoneId} className={styles.section}>
        <h2 id={everyoneId} className={styles.sectionTitle}>
          {t("balances.everyone")}
        </h2>
        <ul className={styles.list}>
          {view.balances.map((entry) => (
            <BalanceRow key={entry.person.userId} entry={entry} household={household} />
          ))}
        </ul>
      </Card>
      {view.suggestions.length > 0 && (
        <Card as="section" padding="lg" aria-labelledby={suggestionsId} className={styles.section}>
          <h2 id={suggestionsId} className={styles.sectionTitle}>
            {t("balances.suggestions")}
          </h2>
          <ul className={styles.list}>
            {view.suggestions.map((suggestion) => (
              <SuggestionRow key={`${suggestion.from.userId}-${suggestion.to.userId}`} suggestion={suggestion} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function BalanceRow({ entry, household }: { entry: PersonBalance; household: HouseholdView }) {
  const { t } = useTranslation("expenses");
  const user = useCurrentUser();
  const money = useMoney();
  const mySentence = useBalanceSentence();
  const { person, balanceCents } = entry;

  const sentence =
    person.userId === user.id
      ? mySentence(balanceCents)
      : balanceCents < 0
        ? t("balances.personOwes", { name: person.name, amount: money(-balanceCents) })
        : balanceCents > 0
          ? t("balances.personIsOwed", { name: person.name, amount: money(balanceCents) })
          : t("balances.personIsSquare", { name: person.name });

  return (
    <li className={styles.row}>
      <Avatar size="sm" decorative {...avatarPropsFor(person, household.members)} />
      <span className={clsx(styles.sentence, balanceCents < 0 && styles.owes, balanceCents > 0 && styles.owed)}>
        {sentence}
      </span>
    </li>
  );
}

function SuggestionRow({ suggestion }: { suggestion: SuggestedSettlement }) {
  const { t } = useTranslation("expenses");
  const user = useCurrentUser();
  const money = useMoney();
  const { from, to, amountCents } = suggestion;
  const amount = money(amountCents);

  const sentence =
    from.userId === user.id
      ? t("suggest.youPay", { name: to.name, amount })
      : to.userId === user.id
        ? t("suggest.paysYou", { name: from.name, amount })
        : t("suggest.others", { from: from.name, to: to.name, amount });

  return (
    <li className={styles.row}>
      <span className={styles.icon} aria-hidden="true">
        <HandCoins />
      </span>
      <span className={styles.sentence}>{sentence}</span>
    </li>
  );
}
