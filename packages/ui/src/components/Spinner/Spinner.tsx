import clsx from "clsx";
import styles from "./Spinner.module.css";

export interface SpinnerProps {
  /** Accessible description of what is loading, already translated ("Loading your home…"). */
  label: string;
  size?: "md" | "lg";
  className?: string;
}

/** Indicates that something is loading. Announced to screen readers as a status. */
export function Spinner({ label, size = "md", className }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={clsx(styles.spinner, size === "lg" && styles.lg, className)} />
  );
}
