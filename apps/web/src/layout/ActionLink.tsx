import clsx from "clsx";
import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import styles from "./ActionLink.module.css";

export interface ActionLinkProps extends LinkProps {
  variant?: "secondary" | "ghost";
  icon?: ReactNode;
}

/** Navigation that looks like a button. It stays a real link, so it opens in new tabs and reads as a link. */
export function ActionLink({ variant = "secondary", icon, className, children, ...rest }: ActionLinkProps) {
  return (
    <Link className={clsx(styles.link, styles[variant], className)} {...rest}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </Link>
  );
}
