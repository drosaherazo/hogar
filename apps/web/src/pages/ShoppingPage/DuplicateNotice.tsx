import type { ShoppingItemView } from "@hogar/shared";
import { Alert, Button } from "@hogar/ui";
import { useTranslation } from "react-i18next";
import { errorKey } from "../../api/client";
import { useEditShoppingItem } from "../../shopping/useShopping";

export interface DuplicateNoticeProps {
  /** The item already on the list with that name, when the list on screen has it. */
  existing: ShoppingItemView | undefined;
  /** The note the person wrote, or null. */
  note: string | null;
  /** Called once the existing item has the person's note. */
  onNoteUsed: (item: ShoppingItemView) => void;
}

/**
 * "Milk is already on the list." When the person wrote a note the existing item doesn't have,
 * it offers to give it that note, so their detail isn't lost (ADR 0009).
 */
export function DuplicateNotice({ existing, note, onNoteUsed }: DuplicateNoticeProps) {
  const { t } = useTranslation(["shopping", "errors"]);
  const edit = useEditShoppingItem();
  const useMyNote =
    existing !== undefined && note !== null && note !== existing.note
      ? () => edit.mutate({ id: existing.id, input: { note, version: existing.version } }, { onSuccess: onNoteUsed })
      : null;

  return (
    <>
      <Alert
        tone="info"
        action={
          useMyNote && (
            <Button variant="secondary" size="sm" disabled={edit.isPending} onClick={useMyNote}>
              {t("duplicate.useMyNote")}
            </Button>
          )
        }
      >
        {existing ? t("duplicate.message", { name: existing.name }) : t("errors:shopping.item.duplicate")}
      </Alert>
      {edit.isError && <Alert tone="danger">{t(errorKey(edit.error))}</Alert>}
    </>
  );
}
