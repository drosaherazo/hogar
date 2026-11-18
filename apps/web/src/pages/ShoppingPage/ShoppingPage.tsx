import {
  canEditContent,
  errorCodeFrom,
  shoppingItemNameSchema,
  shoppingItemNoteSchema,
  shoppingNameKey,
  type ErrorCode,
  type HouseholdView,
  type PersonRef,
  type ShoppingItemView,
} from "@hogar/shared";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Combobox,
  EmptyState,
  Menu,
  MenuItem,
  Spinner,
  TextField,
  type ComboboxItem,
} from "@hogar/ui";
import clsx from "clsx";
import { Check, MoreHorizontal, Pencil, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router";
import { ApiRequestError, errorKey } from "../../api/client";
import { useCurrentUser } from "../../auth/guards";
import { usePersonLabel } from "../../expenses/people";
import { LoadError } from "../../household/LoadError";
import { useHousehold } from "../../household/useHousehold";
import { AppShell } from "../../layout/AppShell";
import { useReadOnly } from "../../offline/useOnline";
import {
  cartOf,
  useAddShoppingItem,
  useDeleteShoppingItem,
  useFinishShopping,
  useMoveInCart,
  useRestoreShoppingItem,
  useShoppingList,
  useShoppingSuggestions,
  useUndoFinishShopping,
} from "../../shopping/useShopping";
import { useToasts } from "../../toast/Toasts";
import { DuplicateNotice } from "./DuplicateNotice";
import { EditItemDialog } from "./EditItemDialog";
import { CartBar, FinishDialog } from "./FinishShopping";
import styles from "./ShoppingPage.module.css";
import { useCartReturned } from "./useCartReturned";
import { useForgottenCart } from "./useForgottenCart";

const TITLE_ID = "shopping-title";
const NO_ITEMS: ShoppingItemView[] = [];

/** Router state that opens the finish dialog on arrival, as Home's cart reminder does. */
export interface ShoppingPageState {
  finish?: boolean;
}

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
        current && <ListAndForm household={current} />
      )}
    </AppShell>
  );
}

/** Where focus goes once a deleted item's row is gone: the row now in its place, else the one before. */
interface FocusAfterDelete {
  removed: string;
  next: string | null;
}

function ListAndForm({ household }: { household: HouseholdView }) {
  const { t } = useTranslation(["shopping", "common", "errors"]);
  const list = useShoppingList();
  const items = list.data ?? NO_ITEMS;
  const canEdit = canEditContent(household.myRole);
  const toasts = useToasts();
  const remove = useDeleteShoppingItem();
  const restore = useRestoreShoppingItem();
  const move = useMoveInCart();
  const finish = useFinishShopping();
  const undoFinish = useUndoFinishShopping();
  const user = useCurrentUser();
  const cartReturned = useCartReturned(items);
  const myCart = canEdit ? cartOf(items, user.id) : NO_ITEMS;
  const forgotten = useForgottenCart(myCart.length, list.isSuccess);
  const location = useLocation();
  const navigate = useNavigate();
  // Arriving from Home's reminder opens the finish dialog as soon as the cart is known.
  const finishOnArrival = (location.state as ShoppingPageState | null)?.finish === true;
  const [finishing, setFinishing] = useState(finishOnArrival);
  // A cart that is empty (or emptied elsewhere) has nothing to finish: the dialog closes for good.
  if (finishing && list.isSuccess && myCart.length === 0) setFinishing(false);
  const focusAfterFinish = useRef(false);
  const nameField = useRef<HTMLInputElement>(null);
  const listElement = useRef<HTMLUListElement>(null);
  const focusAfterDelete = useRef<FocusAfterDelete | null>(null);
  const [editing, setEditing] = useState<ShoppingItemView | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);

  // A deleted row takes its focused button with it: keep the keyboard on the list (or on adding,
  // when the list is now empty) instead of dropping it at the top of the page.
  useEffect(() => {
    const target = focusAfterDelete.current;
    if (!target || items.some((item) => item.id === target.removed)) return;
    focusAfterDelete.current = null;
    const buttons = listElement.current?.querySelectorAll<HTMLElement>("[data-options-for]") ?? [];
    const next = Array.from(buttons).find((button) => button.dataset["optionsFor"] === target.next);
    (next ?? nameField.current)?.focus();
  }, [items]);

  // Only once: going back or reloading doesn't open it again.
  useEffect(() => {
    if (finishOnArrival) void navigate(location.pathname, { replace: true, state: null });
  }, [finishOnArrival, navigate, location.pathname]);

  // The bar that opened the dialog leaves with the cart: keep the keyboard on the page, on adding.
  useEffect(() => {
    if (focusAfterFinish.current && myCart.length === 0) {
      focusAfterFinish.current = false;
      nameField.current?.focus();
    }
  }, [myCart.length]);

  function reset() {
    setDone(null);
    setFailure(null);
  }

  /** Off the list at once; "Undo" in the toast brings it back while the server still allows it. */
  function deleteItem(item: ShoppingItemView) {
    reset();
    const index = items.findIndex((other) => other.id === item.id);
    focusAfterDelete.current = { removed: item.id, next: (items[index + 1] ?? items[index - 1])?.id ?? null };
    remove.mutate(item, {
      onSuccess: () =>
        toasts.show({
          message: t("deleted", { name: item.name }),
          action: { label: t("undo"), onAction: () => undo(item) },
        }),
      onError: setFailure,
    });
  }

  function undo(item: ShoppingItemView) {
    reset();
    restore.mutate(item.id, {
      onSuccess: (back) => setDone(t("restored", { name: back.name })),
      onError: setFailure,
    });
  }

  /** Everything in the viewer's cart leaves the list at once; "Undo" in the toast puts it back. */
  function finishWithoutExpense() {
    reset();
    const itemIds = myCart.map((item) => item.id);
    setFinishing(false);
    focusAfterFinish.current = true;
    finish.mutate(itemIds, {
      onSuccess: () =>
        toasts.show({
          message: t("finish.done", { count: itemIds.length }),
          action: { label: t("undo"), onAction: () => undoFinishing(itemIds) },
        }),
      onError: (error) => {
        focusAfterFinish.current = false;
        setFailure(error);
      },
    });
  }

  function undoFinishing(itemIds: readonly string[]) {
    reset();
    undoFinish.mutate(itemIds, {
      onSuccess: (back) => setDone(t("finish.undone", { count: back.length })),
      onError: setFailure,
    });
  }

  /**
   * Into the viewer's cart or out of it, at once. When someone else got there first, the item
   * moves back, the list shows whose cart it is in, and the alert says why.
   */
  function toggleCart(item: ShoppingItemView) {
    reset();
    const me: PersonRef = { userId: user.id, name: user.name, avatarUrl: user.avatarUrl, former: false };
    const owner = item.cartOwner?.userId === user.id ? null : me;
    move.mutate({ item, owner }, { onError: setFailure });
  }

  return (
    <>
      {cartReturned && <Alert tone="info">{t("cartReturned")}</Alert>}
      {forgotten && myCart.length > 0 && (
        <Alert
          tone="warning"
          action={
            <Button variant="secondary" size="sm" onClick={() => setFinishing(true)}>
              {t("cartBar.finish")}
            </Button>
          }
        >
          {t("reminder.title", { count: myCart.length })}
        </Alert>
      )}
      {canEdit ? (
        <AddItemForm items={items} nameField={nameField} />
      ) : (
        <p className={styles.muted}>{t("guest.readOnly")}</p>
      )}
      {failure !== null && <Alert tone="danger">{t(failureKey(failure))}</Alert>}
      {done !== null && <Confirmation>{done}</Confirmation>}
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
          <ul ref={listElement} className={styles.list} aria-labelledby={TITLE_ID}>
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                actions={
                  canEdit
                    ? {
                        onToggleCart: () => toggleCart(item),
                        onEdit: () => {
                          reset();
                          setEditing(item);
                        },
                        onDelete: () => deleteItem(item),
                      }
                    : undefined
                }
              />
            ))}
          </ul>
        </Card>
      )}
      {myCart.length > 0 && <CartBar count={myCart.length} onFinish={() => setFinishing(true)} />}
      <FinishDialog
        open={finishing && myCart.length > 0}
        onOpenChange={setFinishing}
        count={myCart.length}
        onRecord={() => void navigate("/shopping/finish")}
        onFinishWithoutExpense={finishWithoutExpense}
      />
      {editing && (
        <EditItemDialog
          item={editing}
          items={items}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setDone(message);
          }}
        />
      )}
    </>
  );
}

/** What a refused change says; a finish refused for a changed cart asks to check it and finish again. */
function failureKey(failure: unknown) {
  return failure instanceof ApiRequestError && failure.code === "shopping.cart.changed"
    ? "shopping:finish.cartChanged"
    : errorKey(failure);
}

/** A short confirmation after a change, read out without interrupting. */
function Confirmation({ children }: { children: string }) {
  return (
    <p role="status" className={styles.confirmation}>
      <Check aria-hidden="true" className={styles.confirmationIcon} />
      {children}
    </p>
  );
}

interface ItemActions {
  onToggleCart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * A name and, in smaller text, the note and who asked for it: never the viewer (they know), and
 * nobody while the household hides it (the server then leaves `askedBy` out). Admins and members
 * get its actions: the check that puts it in their cart, and a menu, so the row stays quick to scan
 * in a shop.
 *
 * An item in a cart stays in its place, quieter but readable, with a check and whose cart it is in,
 * so color never says it alone. While it is in someone else's cart, only they can change it: its
 * check and actions are off, and say why. The menu opens outside the page, so if the connection
 * drops while it is open, its actions are switched off here, saying why (ADR 0015).
 */
function ItemRow({ item, actions }: { item: ShoppingItemView; actions: ItemActions | undefined }) {
  const { t } = useTranslation(["shopping", "common"]);
  const readOnly = useReadOnly();
  const user = useCurrentUser();
  const personLabel = usePersonLabel();
  const markerId = useId();
  const askedBy =
    item.askedBy === undefined || item.askedBy.userId === user.id
      ? null
      : t("item.askedBy", { name: personLabel(item.askedBy) });
  const inMyCart = item.cartOwner?.userId === user.id;
  const holder = item.cartOwner && !inMyCart ? personLabel(item.cartOwner) : null;
  const marker =
    item.cartOwner === null ? null : holder === null ? t("item.inMyCart") : t("item.inCartOf", { name: holder });
  const lockedReason =
    holder !== null
      ? t("item.lockedReason", { name: holder })
      : readOnly
        ? t("common:offline.actionDisabled")
        : undefined;
  // What a locked control is described by: the marker next to it, which says whose cart it is in.
  const describedBy = holder === null ? undefined : markerId;

  return (
    <li className={clsx(styles.item, marker !== null && styles.inCart)}>
      <span className={styles.itemText}>
        {actions ? (
          <Checkbox
            label={item.name}
            aria-label={t(inMyCart ? "item.takeOutOfCart" : "item.putInCart", { name: item.name })}
            aria-describedby={describedBy}
            checked={inMyCart}
            disabled={holder !== null}
            onChange={actions.onToggleCart}
            className={styles.cart}
          />
        ) : (
          <span className={styles.itemName}>{item.name}</span>
        )}
        {(item.note !== null || askedBy !== null || marker !== null) && (
          <span className={clsx(styles.details, actions && styles.pastCheck)}>
            {(item.note !== null || askedBy !== null) && (
              <span className={styles.itemMeta}>
                {item.note !== null && <span className={styles.note}>{item.note}</span>}
                {askedBy !== null && <span>{askedBy}</span>}
              </span>
            )}
            {marker !== null && (
              <Badge id={markerId} tone="positive" className={styles.marker}>
                <Check aria-hidden="true" className={styles.markerIcon} />
                {marker}
              </Badge>
            )}
          </span>
        )}
      </span>
      {actions && (
        <Menu
          trigger={
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("item.actions", { name: item.name })}
              aria-describedby={describedBy}
              data-options-for={item.id}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          }
        >
          <MenuItem
            icon={<Pencil />}
            onSelect={actions.onEdit}
            disabled={lockedReason !== undefined}
            description={lockedReason}
          >
            {t("item.edit")}
          </MenuItem>
          <MenuItem
            icon={<Trash2 />}
            onSelect={actions.onDelete}
            disabled={lockedReason !== undefined}
            description={lockedReason}
          >
            {t("item.delete")}
          </MenuItem>
        </Menu>
      )}
    </li>
  );
}

type Field = "name" | "note";

/**
 * Adding an item: a name and an optional note. Enter adds from either field, because most items
 * have no note and people add them one after another, often with one hand in a shop. While the
 * person types the name, what the household bought before is suggested, the most bought first, so
 * the usual things take one tap; each suggestion says how often it was bought and brings its last
 * note.
 */
function AddItemForm({
  items,
  nameField,
}: {
  items: readonly ShoppingItemView[];
  nameField: RefObject<HTMLInputElement | null>;
}) {
  const { t } = useTranslation(["shopping", "errors"]);
  const add = useAddShoppingItem();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const suggestions = useShoppingSuggestions(name, items);
  const options = useMemo(
    () =>
      suggestions.map((suggestion): ComboboxItem => ({
        id: shoppingNameKey(suggestion.name),
        label: suggestion.name,
        detail: [suggestion.note, t("suggestion.timesBought", { count: suggestion.timesBought })]
          .filter(Boolean)
          .join(" · "),
      })),
    [suggestions, t],
  );
  const [errors, setErrors] = useState<Partial<Record<Field, ErrorCode>>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [duplicateKey, setDuplicateKey] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // The item behind a duplicate notice, found in the list the person already sees.
  const existing =
    duplicateKey === null ? undefined : items.find((item) => shoppingNameKey(item.name) === duplicateKey);
  const typedNote = shoppingItemNoteSchema.safeParse(note);

  /** Empties the form for the next item, saying what just happened. */
  function startOver(message: string) {
    setName("");
    setNote("");
    setDuplicateKey(null);
    setDone(message);
    nameField.current?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    setDuplicateKey(null);
    setDone(null);
    const parsedName = shoppingItemNameSchema.safeParse(name);
    const parsedNote = shoppingItemNoteSchema.safeParse(note);
    const fieldErrors: Partial<Record<Field, ErrorCode>> = {};
    if (!parsedName.success) fieldErrors.name = errorCodeFrom(parsedName.error);
    if (!parsedNote.success) fieldErrors.note = errorCodeFrom(parsedNote.error);
    setErrors(fieldErrors);
    if (!parsedName.success || !parsedNote.success) return;

    try {
      const item = await add.mutateAsync({ name: parsedName.data, note: parsedNote.data });
      startOver(t("added", { name: item.name }));
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === "shopping.item.duplicate") {
        setDuplicateKey(shoppingNameKey(parsedName.data));
      } else {
        setFailure(error);
      }
    }
  }

  /** A suggestion brings its name and last note; both stay editable before adding. */
  function pick(id: string) {
    const suggestion = suggestions.find((other) => shoppingNameKey(other.name) === id);
    if (!suggestion) return;
    setName(suggestion.name);
    setNote(suggestion.note ?? "");
    setDuplicateKey(null);
  }

  const fieldError = (field: Field) => {
    const code = errors[field];
    return code ? t(`errors:${code}`) : undefined;
  };

  return (
    <Card padding="lg">
      <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {failure !== null && <Alert tone="danger">{t(errorKey(failure))}</Alert>}
        <Combobox
          allowsCustomValue
          inputRef={nameField}
          label={t("add.nameLabel")}
          inputValue={name}
          enterKeyHint="done"
          onInputChange={(value) => {
            setName(value);
            setDuplicateKey(null);
          }}
          items={options}
          onSelectionChange={pick}
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
          <DuplicateNotice
            existing={existing}
            note={typedNote.success ? typedNote.data : null}
            onNoteUsed={(item) => startOver(t("duplicate.noteUsed", { name: item.name }))}
          />
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
        {done !== null && <Confirmation>{done}</Confirmation>}
      </form>
    </Card>
  );
}
