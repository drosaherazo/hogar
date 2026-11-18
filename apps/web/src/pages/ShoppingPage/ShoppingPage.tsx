import {
  canEditContent,
  errorCodeFrom,
  shoppingItemNameSchema,
  shoppingItemNoteSchema,
  shoppingNameKey,
  type ErrorCode,
  type HouseholdView,
  type ShoppingItemView,
} from "@hogar/shared";
import { Alert, Button, Card, EmptyState, Spinner, TextField } from "@hogar/ui";
import { Check, Plus, ShoppingBasket } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { ApiRequestError, errorKey } from "../../api/client";
import { useCurrentUser } from "../../auth/guards";
import { usePersonLabel } from "../../expenses/people";
import { LoadError } from "../../household/LoadError";
import { useHousehold } from "../../household/useHousehold";
import { AppShell } from "../../layout/AppShell";
import { useAddShoppingItem, useShoppingList } from "../../shopping/useShopping";
import styles from "./ShoppingPage.module.css";

const TITLE_ID = "shopping-title";

/** The household's one shopping list: what's needed, in the order it was asked for, and the way to add to it. */
export function ShoppingPage() {
  const { t } = useTranslation(["shopping", "common"]);
  const household = useHousehold();

  if (household.isSuccess && !household.data.household) return <Navigate to="/" replace />;
  const current = household.data?.household;

  return (
    <AppShell>
      <h1 id={TITLE_ID} className={styles.title}>
        {t("title")}
      </h1>
      {household.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : household.isError ? (
        <LoadError error={household.error} onRetry={() => void household.refetch()} />
      ) : (
        current && <ShoppingList household={current} />
      )}
    </AppShell>
  );
}

function ShoppingList({ household }: { household: HouseholdView }) {
  const { t } = useTranslation(["shopping", "common"]);
  const list = useShoppingList();
  const items = list.data ?? [];

  return (
    <>
      {canEditContent(household.myRole) ? (
        <AddItemForm items={items} />
      ) : (
        <p className={styles.muted}>{t("guest.readOnly")}</p>
      )}
      {list.isPending ? (
        <Spinner label={t("common:loading")} />
      ) : list.isError ? (
        <LoadError error={list.error} title={t("loadError")} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <Card padding="lg">
          <EmptyState icon={<ShoppingBasket />} title={t("empty.title")} description={t("empty.description")} />
        </Card>
      ) : (
        <Card padding="md">
          <ul className={styles.list} aria-labelledby={TITLE_ID}>
            {items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

/** A name and, in smaller text, the note and who asked for it (never the viewer: they know). */
function ItemRow({ item }: { item: ShoppingItemView }) {
  const { t } = useTranslation("shopping");
  const user = useCurrentUser();
  const personLabel = usePersonLabel();
  const askedBy = item.askedBy.userId === user.id ? null : t("item.askedBy", { name: personLabel(item.askedBy) });

  return (
    <li className={styles.item}>
      <span className={styles.itemName}>{item.name}</span>
      {(item.note !== null || askedBy !== null) && (
        <span className={styles.itemMeta}>
          {item.note !== null && <span className={styles.note}>{item.note}</span>}
          {askedBy !== null && <span>{askedBy}</span>}
        </span>
      )}
    </li>
  );
}

type Field = "name" | "note";

/**
 * Adding an item: a name and an optional note. Enter adds from either field, because most items
 * have no note and people add them one after another, often with one hand in a shop.
 */
function AddItemForm({ items }: { items: readonly ShoppingItemView[] }) {
  const { t } = useTranslation(["shopping", "errors"]);
  const add = useAddShoppingItem();
  const nameField = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, ErrorCode>>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [duplicateKey, setDuplicateKey] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  // The item behind a duplicate notice, found in the list the person already sees.
  const existing =
    duplicateKey === null ? undefined : items.find((item) => shoppingNameKey(item.name) === duplicateKey);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    setDuplicateKey(null);
    setAdded(null);
    const parsedName = shoppingItemNameSchema.safeParse(name);
    const parsedNote = shoppingItemNoteSchema.safeParse(note);
    const fieldErrors: Partial<Record<Field, ErrorCode>> = {};
    if (!parsedName.success) fieldErrors.name = errorCodeFrom(parsedName.error);
    if (!parsedNote.success) fieldErrors.note = errorCodeFrom(parsedNote.error);
    setErrors(fieldErrors);
    if (!parsedName.success || !parsedNote.success) return;

    try {
      const item = await add.mutateAsync({ name: parsedName.data, note: parsedNote.data });
      setName("");
      setNote("");
      setAdded(item.name);
      nameField.current?.focus();
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "shopping.item.duplicate") {
        setDuplicateKey(shoppingNameKey(parsedName.data));
      } else {
        setFailure(error);
      }
    }
  }

  const fieldError = (field: Field) => {
    const code = errors[field];
    return code ? t(`errors:${code}`) : undefined;
  };

  return (
    <Card padding="lg">
      <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {failure !== null && <Alert tone="danger">{t(errorKey(failure))}</Alert>}
        <TextField
          ref={nameField}
          label={t("add.nameLabel")}
          value={name}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(event) => {
            setName(event.target.value);
            setDuplicateKey(null);
          }}
          error={fieldError("name")}
        />
        <TextField
          label={t("add.noteLabel")}
          hint={t("add.noteHint")}
          value={note}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(event) => setNote(event.target.value)}
          error={fieldError("note")}
        />
        {duplicateKey !== null && (
          <Alert tone="info">
            {existing ? t("duplicate.message", { name: existing.name }) : t("errors:shopping.item.duplicate")}
          </Alert>
        )}
        <Button
          type="submit"
          icon={<Plus />}
          loading={add.isPending}
          loadingLabel={t("add.adding")}
          className={styles.submit}
        >
          {t("add.submit")}
        </Button>
        {added !== null && (
          <p role="status" className={styles.added}>
            <Check aria-hidden="true" className={styles.addedIcon} />
            {t("added", { name: added })}
          </p>
        )}
      </form>
    </Card>
  );
}
