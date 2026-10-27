import clsx from "clsx";
import { useState } from "react";
import styles from "./Avatar.module.css";

export type MemberColorIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface AvatarProps {
  /** The person's name. Used for the initials and as the accessible name. */
  name: string;
  /** Photo URL. Falls back to initials when missing or when it fails to load. */
  src?: string | null | undefined;
  /** Member color, assigned by join order in the household (1–8). */
  colorIndex?: MemberColorIndex;
  size?: "sm" | "md" | "lg";
  /** Set when a visible name sits right next to the avatar, so screen readers don't hear it twice. */
  decorative?: boolean;
  className?: string;
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return (first + last).toLocaleUpperCase();
}

/** A person's photo, or their initials on their member color. */
export function Avatar({ name, src, colorIndex = 1, size = "md", decorative = false, className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const image = src && failedSrc !== src ? src : null;
  const a11y = decorative ? { "aria-hidden": true } : { role: "img", "aria-label": name };

  return (
    <span
      className={clsx(styles.avatar, size !== "md" && styles[size], styles[`member${colorIndex}`], className)}
      {...a11y}
    >
      {image ? (
        <img
          className={styles.image}
          src={image}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(image)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
