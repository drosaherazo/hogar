import clsx from "clsx";
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import styles from "./Checkbox.module.css";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type" | "size"> {
  /** Visible label, already translated. Clicking it toggles the box. */
  label: string;
  /** What ticking it means, already translated; read with the box by screen readers. */
  hint?: string | undefined;
  /**
   * The box's color: `accent` for a choice in a form; `positive` (teal) for a check that ticks
   * something off, such as putting an item in your cart, where the accent is kept for the main action.
   */
  tone?: "accent" | "positive";
  /** The label's size: `md` in a form; `lg` when the label is a list item's name, read at a glance. */
  size?: "md" | "lg";
}

/**
 * A single on/off choice that takes effect when the form is saved, such as "use its own split", or
 * a check on a list item. A native checkbox, so keyboard, screen readers and forms work without
 * extra code. The label wraps the box, so the whole row (box, gap and text) is one target with no
 * dead zones. Its text takes the color of the element around it (the root, through `className`).
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, tone = "accent", size = "md", className, ...rest },
  ref,
) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className={clsx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className={clsx(styles.input, styles[tone])}
          aria-describedby={hint ? hintId : undefined}
          {...rest}
        />
        <span className={clsx(styles.text, styles[size])}>{label}</span>
      </label>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
});
