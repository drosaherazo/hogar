import { shoppingNameKey, type ShoppingItemView } from "@hogar/shared";
import { Alert, Button, Dialog, TextField } from "@hogar/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiRequestError, errorKey } from "../../api/client";
import { moveToNextField } from "../../forms/moveToNextField";
import { describedByOffline } from "../../offline/OfflineBanner";
import { useReadOnly } from "../../offline/useOnline";
import { useEditShoppingItem } from "../../shopping/useShopping";
import { DuplicateNotice } from "./DuplicateNotice";
import styles from "./ShoppingPage.module.css";
import { useItemFields } from "./useItemFields";

export interface EditItemDialogProps {
  /** The item as it was when the person opened the dialog: the edit is based on its version. */
  item: ShoppingItemView;
  /** The list as it is now, kept live: someone else's newer version, or the item behind a duplicate. */
  items: readonly ShoppingItemView[];
  onClose: () => void;
  /** Called after a save, with what to confirm. */
  onDone: (message: string) => void;
}

/**
 * Fixing an item's name or note. When someone else saved a change meanwhile, the server refuses
 * the edit and the dialog shows their version: the person keeps it or saves theirs over it, never
 * overwriting it without seeing it (ADR 0009). The dialog sits outside the page, so if the
 * connection drops while it is open, saving is switched off here, with the reason (ADR 0015).
 */
export function EditItemDialog({ item, items, onClose, onDone }: EditItemDialogProps) {
  const { t } = useTranslation(["shopping", "errors"]);
  const edit = useEditShoppingItem();
  const readOnly = useReadOnly();
  const nameField = useRef<HTMLInputElement>(null);
  const keepNew = useRef<HTMLButtonElement>(null);
  const fields = useItemFields(item);
  // The version this edit is based on; after a refusal it stays until the person chooses.
  const [version, setVersion] = useState(item.version);
  const [changed, setChanged] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const latest = items.find((other) => other.id === item.id);
  const conflict = changed && latest !== undefined;
  const { duplicateKey } = fields;
  const existing =
    duplicateKey === null
      ? undefined
      : items.find((other) => other.id !== item.id && shoppingNameKey(other.name) === duplicateKey);

  // The choice replaces Save and Cancel; focus moves to its safe option, as when a dialog opens.
  useEffect(() => {
    if (conflict) keepNew.current?.focus();
  }, [conflict]);

  async function save(baseVersion: number) {
    setFailure(null);
    const input = fields.parse();
    if (!input) return;
    // Nothing to save: closing changes nothing, for anyone.
    if (!changed && input.name === item.name && input.note === item.note) {
      onClose();
      return;
    }

    try {
      const saved = await edit.mutateAsync({
        id: item.id,
        input: { ...input, version: baseVersion },
      });
      onDone(t("edit.saved", { name: saved.name }));
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "shopping.item.changed") {
        setVersion(baseVersion);
        setChanged(true);
      } else if (!fields.refusedAsDuplicate(error, input.name)) {
        setFailure(error);
      }
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("edit.title", { name: item.name })}
      closeLabel={t("close")}
      initialFocus={nameField}
      actions={
        conflict ? (
          <>
            <Button ref={keepNew} variant="secondary" onClick={onClose}>
              {t("changed.keepNew")}
            </Button>
            <Button
              loading={edit.isPending}
              loadingLabel={t("edit.saving")}
              // Until the list shows the newer version, saving would be refused again.
              disabled={readOnly || latest.version === version}
              aria-describedby={describedByOffline(readOnly)}
              onClick={() => void save(latest.version)}
            >
              {t("changed.saveMine")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              form="edit-item-form"
              loading={edit.isPending}
              loadingLabel={t("edit.saving")}
              disabled={readOnly}
              aria-describedby={describedByOffline(readOnly)}
            >
              {t("edit.save")}
            </Button>
          </>
        )
      }
    >
      <form
        id="edit-item-form"
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!readOnly) void save(version);
        }}
        onKeyDown={moveToNextField}
        noValidate
      >
        {conflict && (
          <Alert tone="warning" title={t("changed.title")}>
            <span className={styles.itemText}>
              <span className={styles.itemName}>{latest.name}</span>
              {latest.note !== null && <span className={styles.itemMeta}>{latest.note}</span>}
            </span>
          </Alert>
        )}
        {changed && latest === undefined && <Alert tone="danger">{t("errors:shopping.item.not_found")}</Alert>}
        {failure !== null && <Alert tone="danger">{t(errorKey(failure))}</Alert>}
        <TextField
          ref={nameField}
          label={t("add.nameLabel")}
          value={fields.name}
          autoComplete="off"
          enterKeyHint="next"
          onChange={(event) => fields.changeName(event.target.value)}
          error={fields.fieldError("name")}
        />
        <TextField
          label={t("add.noteLabel")}
          hint={t("add.noteHint")}
          value={fields.note}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(event) => fields.changeNote(event.target.value)}
          error={fields.fieldError("note")}
        />
        {duplicateKey !== null && (
          <DuplicateNotice
            existing={existing}
            note={fields.noteForDuplicate}
            onNoteUsed={(other) => onDone(t("duplicate.noteUsed", { name: other.name }))}
          />
        )}
      </form>
    </Dialog>
  );
}
