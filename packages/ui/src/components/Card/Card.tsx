import clsx from "clsx";
import type { HTMLAttributes } from "react";
import styles from "./Card.module.css";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Use `section` or `article` when the card is a self-contained part of the page. */
  as?: "div" | "section" | "article";
  padding?: "md" | "lg";
  elevated?: boolean;
}

/** A soft surface that groups related content, like a sheet of paper resting on the table. */
export function Card({ as: Element = "div", padding = "md", elevated = false, className, ...rest }: CardProps) {
  return (
    <Element
      className={clsx(
        styles.card,
        padding === "lg" ? styles.padLg : styles.padMd,
        elevated && styles.elevated,
        className,
      )}
      {...rest}
    />
  );
}
