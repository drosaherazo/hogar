import clsx from "clsx";
import { Check, ChevronDown, CircleAlert } from "lucide-react";
import {
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import {
  Button,
  ComboBox,
  ComboBoxStateContext,
  I18nProvider,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
  type Key,
} from "react-aria-components";
import { useLocale } from "../../locale/LocaleProvider";
import styles from "./Combobox.module.css";

// react-aria types `className` as a plain string; CSS Module lookups are `string | undefined`,
// so the classes passed to its components go through clsx.

export interface ComboboxItem {
  id: string;
  /** Visible name, already translated. Also what the field shows once it is chosen. */
  label: string;
  /** A short code shown beside the name ("KWD"), so similar names can be told apart. */
  tag?: string | undefined;
  /** Secondary text under the name, already translated: why this option matched ("Used in Kuwait"). */
  detail?: string | undefined;
}

interface ComboboxFieldProps {
  /** Visible label, already translated. Always shown. */
  label: string;
  /** Extra guidance under the field, already translated. */
  hint?: string | undefined;
  /** What went wrong and how to fix it, already translated. Marks the field invalid. */
  error?: string | undefined;
  className?: string | undefined;
  /** The text input, so a form can move focus to the field (back to it after an error). */
  inputRef?: Ref<HTMLInputElement> | undefined;
  /** What the phone keyboard's enter key says while typing (`"done"` when Enter submits the form). */
  enterKeyHint?: InputHTMLAttributes<HTMLInputElement>["enterKeyHint"];
}

/** Picks exactly one option from a list the app knows in full, like a household's currency. */
export interface ComboboxSelectProps extends ComboboxFieldProps {
  allowsCustomValue?: false | undefined;
  /**
   * The options matching what the person typed, in the order to show them. An empty query must
   * return every option. Matching is the app's job, so it can search by more than the visible
   * name; keep the function stable (`useCallback`/`useMemo`) since the full list is derived from it.
   */
  search: (query: string) => readonly ComboboxItem[];
  /** The chosen option's id. */
  selectedId: string;
  onSelectionChange: (id: string) => void;
  /** What the list says when nothing matches, already translated, given what was typed. */
  noResults: (query: string) => string;
  /** Accessible name of the button that opens the full list, already translated. */
  triggerLabel: string;
}

/**
 * Free text, with suggestions for what the person types, like a shopping item's name: the text is
 * theirs, and a suggestion only fills it in faster.
 */
export interface ComboboxFreeTextProps extends ComboboxFieldProps {
  allowsCustomValue: true;
  /** What the field holds. */
  inputValue: string;
  onInputChange: (value: string) => void;
  /**
   * The suggestions for what was typed, in the order to show them. They may arrive a moment after
   * the typing (from a server); the list opens when they do. Empty keeps the list closed: typing
   * something new is normal, not a dead end.
   */
  items: readonly ComboboxItem[];
  /** A suggestion was picked. The field already shows its label; the app can fill other fields from it. */
  onSelectionChange: (id: string) => void;
}

export type ComboboxProps = ComboboxSelectProps | ComboboxFreeTextProps;

/**
 * A text field with a list of options under it, built on react-aria's `ComboBox`, so keyboard use,
 * focus and screen reader announcements come from a tested library; the look and the matching
 * rules are ours. By default it picks one option from a long list, like the ~150 currencies a
 * household can use: leaving the field with half-typed text goes back to the chosen option, so it
 * never holds a value that isn't one. With `allowsCustomValue` the text is free and the options are
 * suggestions for it.
 */
export function Combobox(props: ComboboxProps) {
  return props.allowsCustomValue ? <FreeTextCombobox {...props} /> : <SelectCombobox {...props} />;
}

function SelectCombobox({
  search,
  selectedId,
  onSelectionChange,
  noResults,
  triggerLabel,
  allowsCustomValue: _select,
  ...field
}: ComboboxSelectProps) {
  const all = useMemo(() => search(""), [search]);
  const labelOf = (key: string) => all.find((item) => item.id === key)?.label ?? "";

  const [inputValue, setInputValue] = useState(() => labelOf(selectedId));
  // Whether the list follows what was typed. Opening it from the button, choosing an option or
  // leaving the field shows everything again, whatever text the field holds.
  const [filtering, setFiltering] = useState(false);
  const [shownFor, setShownFor] = useState({ selectedId, all });
  if (shownFor.selectedId !== selectedId || shownFor.all !== all) {
    // The choice (or the language of the names) changed from outside: show it.
    setShownFor({ selectedId, all });
    setInputValue(labelOf(selectedId));
    setFiltering(false);
  }

  const items = filtering ? search(inputValue) : all;

  function choose(key: Key | null) {
    if (key === null) return;
    const chosen = String(key);
    setInputValue(labelOf(chosen));
    setFiltering(false);
    if (chosen !== selectedId) onSelectionChange(chosen);
  }

  return (
    <Field
      {...field}
      items={items}
      inputValue={inputValue}
      onInputChange={(value) => {
        setInputValue(value);
        setFiltering(true);
      }}
      selectedKey={selectedId}
      onSelectionChange={choose}
      onOpenChange={(_, trigger) => {
        if (trigger === "manual") setFiltering(false);
      }}
      onBlur={() => {
        setInputValue(labelOf(selectedId));
        setFiltering(false);
      }}
      allowsEmptyCollection
      trigger={
        <Button className={clsx(styles.trigger)} aria-label={triggerLabel}>
          <ChevronDown className={styles.chevron} aria-hidden="true" />
        </Button>
      }
      status={
        // Inside the popover, which react-aria keeps visible to screen readers while it's open.
        <p role="status" className={styles.visuallyHidden}>
          {items.length === 0 ? noResults(inputValue.trim()) : ""}
        </p>
      }
      emptyState={() => <p className={styles.empty}>{noResults(inputValue.trim())}</p>}
      showsSelection
    />
  );
}

function FreeTextCombobox({
  inputValue,
  onInputChange,
  items,
  onSelectionChange,
  allowsCustomValue: _freeText,
  ...field
}: ComboboxFreeTextProps) {
  // Whether the person typed since the list last closed. Suggestions that arrive for what they
  // typed open the list; after it closes (Escape, a pick, leaving the field) it waits for typing.
  const typed = useRef(false);
  // The label a pick puts in the field: react-aria reports it as a change of text, but nobody typed it.
  const picked = useRef<string | null>(null);

  return (
    <Field
      {...field}
      items={items}
      inputValue={inputValue}
      onInputChange={(value) => {
        typed.current = value !== picked.current;
        picked.current = null;
        onInputChange(value);
      }}
      onSelectionChange={(key) => {
        const item = key === null ? undefined : items.find((other) => other.id === String(key));
        if (!item) return;
        typed.current = false;
        picked.current = item.label;
        onSelectionChange(item.id);
      }}
      onOpenChange={(isOpen) => {
        if (!isOpen) typed.current = false;
      }}
      allowsCustomValue
      opener={<OpenOnArrival count={items.length} typed={typed} />}
      submitsOnEnter
    />
  );
}

/**
 * react-aria opens the list as the person types only when there is already something to show, but
 * suggestions from a server arrive a moment later: this opens it when they do, for text the person
 * typed and hasn't closed the list on since.
 */
function OpenOnArrival({ count, typed }: { count: number; typed: { current: boolean } }) {
  const state = useContext(ComboBoxStateContext);
  useEffect(() => {
    if (state && state.isFocused && !state.isOpen && count > 0 && typed.current) state.open(null, "input");
  });
  return null;
}

interface FieldProps extends ComboboxFieldProps {
  items: readonly ComboboxItem[];
  inputValue: string;
  onInputChange: (value: string) => void;
  selectedKey?: string;
  onSelectionChange: (key: Key | null) => void;
  onOpenChange: (isOpen: boolean, trigger?: string) => void;
  onBlur?: () => void;
  allowsEmptyCollection?: boolean;
  allowsCustomValue?: boolean;
  /** The button that opens the full list. */
  trigger?: ReactNode;
  /** Announces what the list shows, from inside the popover. */
  status?: ReactNode;
  emptyState?: () => ReactNode;
  opener?: ReactNode;
  /** Marks the chosen option with a check. */
  showsSelection?: boolean;
  /** Enter submits the form even while the list is open, unless an option is focused. */
  submitsOnEnter?: boolean;
}

/** The label, input, messages and popover both kinds share, so they look and behave alike. */
function Field({
  label,
  hint,
  error,
  className,
  inputRef,
  enterKeyHint,
  items,
  trigger,
  status,
  emptyState,
  opener,
  showsSelection = false,
  submitsOnEnter = false,
  ...comboBox
}: FieldProps) {
  const locale = useLocale();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // The error comes first: it's what the person needs to read before anything else.
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <I18nProvider locale={locale}>
      <ComboBox
        className={clsx(styles.field, className)}
        items={items}
        isInvalid={Boolean(error)}
        {...comboBox}
        {...(describedBy && { "aria-describedby": describedBy })}
      >
        <Label className={clsx(styles.label)}>{label}</Label>
        <div className={styles.control}>
          <FieldInput
            inputRef={inputRef}
            enterKeyHint={enterKeyHint}
            withTrigger={trigger !== undefined}
            submitsOnEnter={submitsOnEnter}
          />
          {trigger}
        </div>
        {error && (
          <p id={errorId} className={styles.error}>
            <CircleAlert className={styles.errorIcon} aria-hidden="true" />
            {error}
          </p>
        )}
        {hint && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )}
        {opener}
        <Popover className={clsx(styles.popover)} offset={4}>
          {status}
          <ListBox className={clsx(styles.list)} {...(emptyState && { renderEmptyState: emptyState })}>
            {(item: ComboboxItem) => (
              <ListBoxItem id={item.id} textValue={item.label} className={clsx(styles.option)}>
                {({ isSelected }) => (
                  <>
                    {/* One label, so screen readers read it all as the option's name: "US Dollar USD, Used in Ecuador". */}
                    <Text slot="label" className={clsx(styles.text)}>
                      <span className={styles.name}>
                        {item.label}
                        {item.tag && (
                          <>
                            {" "}
                            <span className={styles.tag}>{item.tag}</span>
                          </>
                        )}
                        {showsSelection && isSelected && <Check className={styles.check} aria-hidden="true" />}
                      </span>
                      {item.detail && (
                        <>
                          <span className={styles.visuallyHidden}>,</span>{" "}
                          <span className={styles.detail}>{item.detail}</span>
                        </>
                      )}
                    </Text>
                  </>
                )}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </ComboBox>
    </I18nProvider>
  );
}

function FieldInput({
  inputRef,
  enterKeyHint,
  withTrigger,
  submitsOnEnter,
}: {
  inputRef: Ref<HTMLInputElement> | undefined;
  enterKeyHint: InputHTMLAttributes<HTMLInputElement>["enterKeyHint"];
  withTrigger: boolean;
  submitsOnEnter: boolean;
}) {
  const state = useContext(ComboBoxStateContext);

  // react-aria keeps Enter from submitting while the list is open, in case it picks an option. With
  // free text and no option focused, Enter means "add what I typed", as in any other field.
  function submitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || !state?.isOpen || state.selectionManager.focusedKey != null) return;
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <Input
      ref={inputRef}
      className={clsx(styles.input, withTrigger && styles.withTrigger)}
      enterKeyHint={enterKeyHint}
      {...(submitsOnEnter && { onKeyDown: submitOnEnter })}
    />
  );
}
