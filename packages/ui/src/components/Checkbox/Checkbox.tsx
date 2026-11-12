import clsx from "clsx";
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import styles from "./Checkbox.module.css";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  /** Visible label, already translated. Clicking it toggles the box. */
  label: string;
  /** What ticking it means, already translated; read with the box by screen readers. */
  hint?: string | undefined;
}

/**
 * A single on/off choice that takes effect when the form is saved, such as "use its own split".
 * A native checkbox, so keyboard, screen readers and forms work without extra code.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, className, ...rest },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className={clsx(styles.field, className)}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={styles.input}
        aria-describedby={hint ? hintId : undefined}
        {...rest}
      />
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
});
