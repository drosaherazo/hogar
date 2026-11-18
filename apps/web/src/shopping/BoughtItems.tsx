import type { BoughtItemView } from "@hogar/shared";
import styles from "./BoughtItems.module.css";

/**
 * What was bought in a shopping trip, each thing with its note on a quieter line, in the order it
 * was added to the list. Read-only: it is the record of the shop, on the expense form and the
 * expense's details alike.
 */
export function BoughtItems({ items, labelledBy }: { items: readonly BoughtItemView[]; labelledBy: string }) {
  return (
    <ul className={styles.items} aria-labelledby={labelledBy}>
      {items.map((item, index) => (
        // Names repeat across trips but not within one; the position keeps a key unique regardless.
        <li key={`${index}-${item.name}`} className={styles.item}>
          <span className={styles.name}>{item.name}</span>
          {item.note && <span className={styles.note}>{item.note}</span>}
        </li>
      ))}
    </ul>
  );
}
