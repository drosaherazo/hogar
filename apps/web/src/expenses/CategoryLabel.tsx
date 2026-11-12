import type { CategoryRef } from "@hogar/shared";
import { Badge } from "@hogar/ui";
import clsx from "clsx";
import styles from "./CategoryLabel.module.css";

/** Text for a category in places that only take plain text, such as `<option>`: "🏠 Rent". */
export function categoryText(category: Pick<CategoryRef, "name" | "emoji">): string {
  return category.emoji ? `${category.emoji} ${category.name}` : category.name;
}

/**
 * A category on an expense: its emoji and name in a neutral badge (research R12). There is no
 * color per category, and the emoji is decorative, so screen readers hear only the name.
 */
export function CategoryLabel({
  category,
  className,
}: {
  category: CategoryRef | null;
  className?: string | undefined;
}) {
  if (!category) return null;
  return (
    <Badge className={clsx(styles.label, className)}>
      {category.emoji && (
        <span aria-hidden="true" className={styles.emoji}>
          {category.emoji}
        </span>
      )}
      {category.name}
    </Badge>
  );
}
