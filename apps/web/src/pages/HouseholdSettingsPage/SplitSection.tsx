import { updateSplitRequestSchema, weightsToBasisPoints, weightSchema, type HouseholdView } from "@hogar/shared";
import { Alert, Button, Card, TextField } from "@hogar/ui";
import { Check } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { errorKey } from "../../api/client";
import { useUpdateSplit } from "../../household/useHousehold";
import { usePercent } from "../../i18n/format";
import styles from "./HouseholdSettingsPage.module.css";

/** Live shares for the weights being typed, or null while any of them isn't valid yet. */
function sharesFor(drafts: string[]): number[] | null {
  const weights = drafts.map((draft) => (draft.trim() === "" ? Number.NaN : Number(draft)));
  if (!weights.every((weight) => weightSchema.safeParse(weight).success)) return null;
  return weights.some((weight) => weight > 0) ? weightsToBasisPoints(weights) : weights.map(() => 0);
}

/** Each member's weight and resulting share. Admins edit; everyone sees the same numbers. */
export function SplitSection({ household }: { household: HouseholdView }) {
  const { t } = useTranslation(["household", "errors"]);
  const percent = usePercent();
  const heading = useRef<HTMLHeadingElement>(null);
  const { hash } = useLocation();
  const isAdmin = household.myRole === "ADMIN";

  // The home banner links to #split: bring the section into view and move focus there.
  useEffect(() => {
    if (hash === "#split") {
      // Optional call: not every environment implements scrollIntoView (jsdom, older browsers).
      heading.current?.scrollIntoView?.({ block: "start" });
      heading.current?.focus();
    }
  }, [hash]);

  return (
    <Card as="section" padding="lg" aria-labelledby="split" className={styles.section}>
      <h2 id="split" ref={heading} tabIndex={-1} className={styles.sectionTitle}>
        {t("settings.split.title")}
      </h2>
      <p className={styles.muted}>{t("settings.split.description")}</p>
      {isAdmin && household.splitNeedsReview && (
        <Alert tone="warning" title={t("home.reviewSplit.title")}>
          {t("home.reviewSplit.description")}
        </Alert>
      )}
      {isAdmin ? (
        // Re-start the form whenever the member list changes, so it never edits stale people.
        <SplitForm key={household.members.map((member) => member.id).join()} household={household} percent={percent} />
      ) : (
        <>
          <ul className={styles.list}>
            {household.members.map((member) => (
              <li key={member.id} className={styles.listItem}>
                <span className={styles.itemTitle}>{member.name}</span>
                <span className={styles.itemMeta}>
                  {t("settings.split.weight", { weight: member.weight })} ·{" "}
                  {t("settings.split.share", { percent: percent(member.shareBps) })}
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.muted}>{t("settings.split.readOnly")}</p>
        </>
      )}
    </Card>
  );
}

function SplitForm({ household, percent }: { household: HouseholdView; percent: (bps: number) => string }) {
  const { t } = useTranslation(["household", "errors"]);
  const save = useUpdateSplit();
  const [drafts, setDrafts] = useState(() => household.members.map((member) => String(member.weight)));
  const shares = sharesFor(drafts);
  const nobodyPays = shares !== null && shares.every((share) => share === 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = updateSplitRequestSchema.safeParse({
      weights: household.members.map((member, index) => ({ membershipId: member.id, weight: Number(drafts[index]) })),
    });
    if (parsed.success) save.mutate(parsed.data.weights);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.weights}>
        {household.members.map((member, index) => {
          const draft = drafts[index] ?? "";
          const invalid = !weightSchema.safeParse(draft.trim() === "" ? Number.NaN : Number(draft)).success;
          const share = shares?.[index];
          return (
            <TextField
              key={member.id}
              inline
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              label={member.name}
              value={draft}
              onChange={(event) => {
                save.reset();
                setDrafts((current) => current.map((value, i) => (i === index ? event.target.value : value)));
              }}
              error={invalid ? t("errors:split.weight.invalid") : undefined}
              hint={
                share !== undefined && !nobodyPays ? t("settings.split.share", { percent: percent(share) }) : undefined
              }
            />
          );
        })}
      </div>
      {nobodyPays && <Alert tone="warning">{t("errors:split.all_zero")}</Alert>}
      {save.isError && <Alert tone="danger">{t(errorKey(save.error))}</Alert>}
      <div className={styles.row}>
        <Button
          type="submit"
          loading={save.isPending}
          loadingLabel={t("settings.split.saving")}
          disabled={shares === null || nobodyPays}
        >
          {t("settings.split.save")}
        </Button>
        {save.isSuccess && (
          <p className={styles.saved} role="status">
            <Check aria-hidden="true" size="1em" /> {t("settings.split.saved")}
          </p>
        )}
      </div>
    </form>
  );
}
