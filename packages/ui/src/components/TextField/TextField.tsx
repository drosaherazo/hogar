import clsx from "clsx";
import { CircleAlert } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import styles from "./TextField.module.css";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  /** Visible label, already translated. Always shown: placeholders are not labels. */
  label: string;
  /** Extra guidance under the field, already translated. */
  hint?: string | undefined;
  /** What went wrong and how to fix it, already translated. Marks the field invalid. */
  error?: string | undefined;
  /** Put the label beside the field instead of above it (compact rows like the split editor). */
  inline?: boolean;
}

/** A labelled text or number input with an optional hint and error. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, inline = false, className, type = "text", ...rest },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // The error comes first: it's what the person needs to read before anything else.
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={clsx(styles.field, inline && styles.inline, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        type={type}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
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
