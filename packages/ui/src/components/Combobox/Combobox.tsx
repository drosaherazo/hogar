import clsx from "clsx";
import { Check, ChevronDown, CircleAlert } from "lucide-react";
import { useId, useMemo, useState, type InputHTMLAttributes, type Ref } from "react";
import {
  Button,
  ComboBox,
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

export interface ComboboxProps {
  /** Visible label, already translated. Always shown. */
  label: string;
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

/**
 * A text field that filters a long list of options as the person types, like the ~150 currencies
 * a household can use. Built on react-aria's `ComboBox`, so keyboard use, focus and screen reader
 * announcements come from a tested library; the look and the matching rules are ours. Leaving the
 * field with half-typed text goes back to the chosen option: it never holds a value that isn't one.
 */
export function Combobox({
  label,
  search,
  selectedId,
  onSelectionChange,
  noResults,
  triggerLabel,
  hint,
  error,
  className,
  inputRef,
  enterKeyHint,
}: ComboboxProps) {
  const locale = useLocale();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // The error comes first: it's what the person needs to read before anything else.
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

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
    <I18nProvider locale={locale}>
      <ComboBox
        className={clsx(styles.field, className)}
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
        isInvalid={Boolean(error)}
        {...(describedBy && { "aria-describedby": describedBy })}
      >
        <Label className={clsx(styles.label)}>{label}</Label>
        <div className={styles.control}>
          <Input ref={inputRef} className={clsx(styles.input)} enterKeyHint={enterKeyHint} />
          <Button className={clsx(styles.trigger)} aria-label={triggerLabel}>
            <ChevronDown className={styles.chevron} aria-hidden="true" />
          </Button>
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
        <Popover className={clsx(styles.popover)} offset={4}>
          {/* Inside the popover, which react-aria keeps visible to screen readers while it's open. */}
          <p role="status" className={styles.visuallyHidden}>
            {items.length === 0 ? noResults(inputValue.trim()) : ""}
          </p>
          <ListBox
            className={clsx(styles.list)}
            renderEmptyState={() => <p className={styles.empty}>{noResults(inputValue.trim())}</p>}
          >
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
                        {isSelected && <Check className={styles.check} aria-hidden="true" />}
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
