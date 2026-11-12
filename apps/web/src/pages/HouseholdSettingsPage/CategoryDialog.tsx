import {
  categoryEmojiSchema,
  categoryNameSchema,
  errorCodeFrom,
  type CategoryView,
  type ErrorCode,
  type HouseholdView,
} from "@hogar/shared";
import { Alert, Button, Checkbox, Dialog, TextField } from "@hogar/ui";
import { Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ApiRequestError, errorKey } from "../../api/client";
import {
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  useUpdateCategorySplit,
} from "../../expenses/useCategories";
import { sharesForDrafts, WeightsEditor } from "../../household/WeightsEditor";
import { useList, usePercent } from "../../i18n/format";
import styles from "./CategoryDialog.module.css";

type Field = "name" | "emoji";

/** Which field an error code belongs to; anything else is shown above the form. */
function fieldOf(code: ErrorCode): Field | null {
  if (code.startsWith("category.name.")) return "name";
  if (code === "category.emoji.invalid") return "emoji";
  return null;
}

/** The weights the editor starts from: the category's own, or a copy of the household's (FR-013). */
function initialDrafts(household: HouseholdView, category: CategoryView | null): string[] {
  const own = new Map(
    (category?.ownSplit ? (category.weights ?? []) : []).map((row) => [row.membershipId, row.weight]),
  );
  return household.members.map((member) => String(category?.ownSplit ? (own.get(member.id) ?? 0) : member.weight));
}

export interface CategoryDialogProps {
  household: HouseholdView;
  /** The category being edited, or `null` to add one. */
  category: CategoryView | null;
  onClose: () => void;
  /** Called after a save or a delete, with what to announce. */
  onDone: (message: "saved" | "deleted") => void;
}

/**
 * Adding or editing a category: its name, an optional emoji and, when editing, the "use its own
 * split" box with the weights. Nothing is saved until Save. A new category always starts by
 * following the household's split.
 */
export function CategoryDialog({ household, category, onClose, onDone }: CategoryDialogProps) {
  const { t } = useTranslation(["household", "errors"]);
  const percent = usePercent();
  const list = useList();
  const create = useCreateCategory();
  const rename = useUpdateCategory();
  const split = useUpdateCategorySplit();
  const nameField = useRef<HTMLInputElement>(null);

  // What's saved on the server: after a rename succeeds but the split fails, a retry must start
  // from the new version and must not rename again.
  const [saved, setSaved] = useState(category);
  const [name, setName] = useState(category?.name ?? "");
  const [emoji, setEmoji] = useState(category?.emoji ?? "");
  const [ownSplit, setOwnSplit] = useState(category?.ownSplit ?? false);
  const [drafts, setDrafts] = useState(() => initialDrafts(household, category));
  const [errors, setErrors] = useState<Partial<Record<Field, ErrorCode>>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [confirmingUntick, setConfirmingUntick] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const shares = sharesForDrafts(drafts);
  const nobodyPays = ownSplit && shares !== null && shares.every((share) => share === 0);
  const saving = create.isPending || rename.isPending || split.isPending;
  const householdShares = list(household.members.map((member) => `${member.name} ${percent(member.shareBps)}`));

  function fail(error: unknown) {
    const code = error instanceof ApiRequestError && error.code !== "network" ? error.code : null;
    const field = code ? fieldOf(code) : null;
    if (code && field) setErrors({ [field]: code });
    else setFailure(error);
  }

  function changeOwnSplit(checked: boolean) {
    // Unticking a category that has saved weights discards them: ask first (FR-014).
    if (!checked && saved?.ownSplit) {
      setConfirmingUntick(true);
      return;
    }
    if (checked && !ownSplit) setDrafts(initialDrafts(household, saved?.ownSplit ? saved : null));
    setOwnSplit(checked);
  }

  function splitChanged(current: CategoryView): boolean {
    if (ownSplit !== current.ownSplit) return true;
    if (!ownSplit) return false;
    return drafts.some((draft, index) => draft !== initialDrafts(household, current)[index]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const parsedName = categoryNameSchema.safeParse(name);
    const parsedEmoji = categoryEmojiSchema.safeParse(emoji);
    const fieldErrors: Partial<Record<Field, ErrorCode>> = {};
    if (!parsedName.success) fieldErrors.name = errorCodeFrom(parsedName.error);
    if (!parsedEmoji.success) fieldErrors.emoji = errorCodeFrom(parsedEmoji.error);
    setErrors(fieldErrors);
    if (!parsedName.success || !parsedEmoji.success) return;
    if (ownSplit && (shares === null || nobodyPays)) return;
    const input = { name: parsedName.data, emoji: parsedEmoji.data };

    try {
      if (!saved) {
        await create.mutateAsync(input);
        onDone("saved");
        return;
      }
      // Up to two requests, in order, each from the latest version: name and emoji, then the split.
      let current = saved;
      if (input.name !== current.name || input.emoji !== current.emoji) {
        current = await rename.mutateAsync({ id: current.id, input: { ...input, version: current.version } });
        setSaved(current);
      }
      if (splitChanged(current)) {
        current = await split.mutateAsync({
          id: current.id,
          input: ownSplit
            ? {
                version: current.version,
                ownSplit: true,
                weights: household.members.map((member, index) => ({
                  membershipId: member.id,
                  weight: Number(drafts[index]),
                })),
              }
            : { version: current.version, ownSplit: false },
        });
        setSaved(current);
      }
      onDone("saved");
    } catch (error) {
      fail(error);
    }
  }

  const fieldError = (field: Field) => {
    const code = errors[field];
    return code ? t(`errors:${code}`) : undefined;
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={saved ? t("settings.categories.edit", { name: saved.name }) : t("settings.categories.dialog.titleNew")}
      closeLabel={t("close")}
      initialFocus={nameField}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form="category-form"
            loading={saving}
            loadingLabel={t("settings.categories.dialog.saving")}
          >
            {t("settings.categories.dialog.save")}
          </Button>
        </>
      }
    >
      <form id="category-form" className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {failure !== null && <Alert tone="danger">{t(errorKey(failure))}</Alert>}
        <TextField
          ref={nameField}
          label={t("settings.categories.dialog.name")}
          value={name}
          maxLength={30}
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
          error={fieldError("name")}
        />
        <TextField
          label={t("settings.categories.dialog.emoji")}
          hint={t("settings.categories.dialog.emojiHint")}
          value={emoji}
          autoComplete="off"
          className={styles.emoji}
          onChange={(event) => setEmoji(event.target.value)}
          error={fieldError("emoji")}
        />
        {saved && (
          <div className={styles.split}>
            <Checkbox
              label={t("settings.categories.dialog.ownSplit")}
              hint={t("settings.categories.dialog.ownSplitHint")}
              checked={ownSplit}
              onChange={(event) => changeOwnSplit(event.target.checked)}
            />
            {ownSplit ? (
              <>
                <WeightsEditor
                  members={household.members}
                  drafts={drafts}
                  onChange={(index, draft) =>
                    setDrafts((current) => current.map((value, i) => (i === index ? draft : value)))
                  }
                />
                {nobodyPays && <Alert tone="warning">{t("errors:split.all_zero")}</Alert>}
              </>
            ) : (
              <p className={styles.muted}>
                {t("settings.categories.dialog.householdShares", { shares: householdShares })}
              </p>
            )}
          </div>
        )}
        {saved && (
          <Button
            variant="secondary"
            icon={<Trash2 />}
            className={styles.delete}
            onClick={() => setConfirmingDelete(true)}
          >
            {t("settings.categories.delete.action")}
          </Button>
        )}
      </form>

      {confirmingUntick && saved && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmingUntick(false);
          }}
          title={t("settings.categories.untick.title")}
          description={t("settings.categories.untick.description", { name: saved.name })}
          closeLabel={t("close")}
          actions={
            <>
              <Button variant="secondary" onClick={() => setConfirmingUntick(false)}>
                {t("cancel")}
              </Button>
              <Button
                onClick={() => {
                  setOwnSplit(false);
                  setConfirmingUntick(false);
                }}
              >
                {t("settings.categories.untick.confirm")}
              </Button>
            </>
          }
        />
      )}

      {confirmingDelete && saved && (
        <DeleteCategoryDialog
          category={saved}
          onCancel={() => setConfirmingDelete(false)}
          onDeleted={() => onDone("deleted")}
        />
      )}
    </Dialog>
  );
}

/**
 * Names the category and says what happens to its expenses (left without a category, nobody's
 * share changes) before deleting it (FR-009). Focus starts on Cancel.
 */
function DeleteCategoryDialog({
  category,
  onCancel,
  onDeleted,
}: {
  category: CategoryView;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation(["household", "errors"]);
  const remove = useDeleteCategory();
  const usage =
    category.expenseCount > 0
      ? t("settings.categories.delete.used", { count: category.expenseCount })
      : t("settings.categories.delete.unused");

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title={t("settings.categories.delete.title", { name: category.name })}
      description={usage}
      closeLabel={t("close")}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button
            loading={remove.isPending}
            loadingLabel={t("settings.categories.delete.deleting")}
            onClick={() => remove.mutate({ id: category.id, version: category.version }, { onSuccess: onDeleted })}
          >
            {t("settings.categories.delete.action")}
          </Button>
        </>
      }
    >
      {category.ownSplit && <p className={styles.muted}>{t("settings.categories.delete.ownSplit")}</p>}
      {remove.isError && <Alert tone="danger">{t(errorKey(remove.error))}</Alert>}
    </Dialog>
  );
}
