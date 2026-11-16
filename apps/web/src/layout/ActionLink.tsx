import clsx from "clsx";
import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import styles from "./ActionLink.module.css";

export interface ActionLinkProps extends LinkProps {
  /** `primary` for a screen's main action (one per screen), like a primary button. */
  variant?: "primary" | "secondary" | "ghost";
  icon?: ReactNode;
  /**
   * A screen's main "create" action: on phones it floats above the tab bar at the trailing edge,
   * in thumb reach; from 48rem up it stays where it is in the page. One per screen.
   */
  floating?: boolean;
}

/** Navigation that looks like a button. It stays a real link, so it opens in new tabs and reads as a link. */
export function ActionLink({
  variant = "secondary",
  icon,
  floating = false,
  className,
  children,
  ...rest
}: ActionLinkProps) {
  return (
    <Link className={clsx(styles.link, styles[variant], floating && styles.floating, className)} {...rest}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </Link>
  );
}
