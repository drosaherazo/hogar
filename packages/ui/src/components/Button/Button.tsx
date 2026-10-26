import clsx from "clsx";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Spinner } from "../Spinner/Spinner";
import styles from "./Button.module.css";

interface BaseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  /** Icon shown before the label. Decorative: the label already says what the button does. */
  icon?: ReactNode;
  fullWidth?: boolean;
}

/** While loading, a translated `loadingLabel` is required so screen readers know what's happening. */
type LoadingProps = { loading?: false; loadingLabel?: never } | { loading?: boolean; loadingLabel: string };

export type ButtonProps = BaseButtonProps & LoadingProps;

/** The main way to trigger an action. One primary button per screen or block. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    icon,
    fullWidth = false,
    loading = false,
    loadingLabel,
    disabled,
    type = "button",
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        styles.button,
        styles[variant],
        size === "sm" && styles.sm,
        fullWidth && styles.fullWidth,
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner label={loadingLabel ?? ""} />
      ) : (
        icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )
      )}
      {children}
    </button>
  );
});
