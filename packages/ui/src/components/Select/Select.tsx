import clsx from "clsx";
import { ChevronDown, CircleAlert } from "lucide-react";
import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  /** Visible text, already translated. */
  label: string;
  disabled?: boolean | undefined;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "children"> {
  /** Visible label, already translated. Always shown. */
  label: string;
  options: readonly SelectOption[];
  /** Extra guidance under the field, already translated. */
  hint?: string | undefined;
  /** What went wrong and how to fix it, already translated. Marks the field invalid. */
  error?: string | undefined;
}

/** A labelled native select with an optional hint and error, matching `TextField`. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, hint, error, className, ...rest },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // The error comes first: it's what the person needs to read before anything else.
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={clsx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <select
          ref={ref}
          id={id}
          className={styles.select}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className={styles.chevron} aria-hidden="true" />
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
    </div>
  );
});
