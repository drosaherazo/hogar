import { weightSchema, weightsToBasisPoints } from "@hogar/shared";
import { TextField } from "@hogar/ui";
import { useTranslation } from "react-i18next";
import { usePercent } from "../i18n/format";
import styles from "./WeightsEditor.module.css";

/** A weight as typed: a whole number from 0 to 100, or not valid yet. */
function parseDraft(draft: string): number {
  return draft.trim() === "" ? Number.NaN : Number(draft);
}

export const isValidWeightDraft = (draft: string) => weightSchema.safeParse(parseDraft(draft)).success;

/** Live shares in basis points for the weights being typed, or null while any of them isn't valid yet. */
export function sharesForDrafts(drafts: readonly string[]): number[] | null {
  const weights = drafts.map(parseDraft);
  if (!weights.every((weight) => weightSchema.safeParse(weight).success)) return null;
  return weights.some((weight) => weight > 0) ? weightsToBasisPoints(weights) : weights.map(() => 0);
}

export interface WeightsEditorProps {
  /** One row per member, in member order. */
  members: readonly { id: string; name: string }[];
  /** The weights being typed, one per member. */
  drafts: readonly string[];
  onChange: (index: number, draft: string) => void;
  disabled?: boolean | undefined;
}

/**
 * One row per member: their name, a weight from 0 to 100 and the share it gives them. Used by
 * the household's split and by each category's own split, so admins meet one way of editing.
 */
export function WeightsEditor({ members, drafts, onChange, disabled }: WeightsEditorProps) {
  const { t } = useTranslation(["household", "errors"]);
  const percent = usePercent();
  const shares = sharesForDrafts(drafts);
  const nobodyPays = shares !== null && shares.every((share) => share === 0);

  return (
    <div className={styles.weights}>
      {members.map((member, index) => {
        const draft = drafts[index] ?? "";
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
            disabled={disabled}
            onChange={(event) => onChange(index, event.target.value)}
            error={isValidWeightDraft(draft) ? undefined : t("errors:split.weight.invalid")}
            hint={
              share !== undefined && !nobodyPays ? t("settings.split.share", { percent: percent(share) }) : undefined
            }
          />
        );
      })}
    </div>
  );
}
