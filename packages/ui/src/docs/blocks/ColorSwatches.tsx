import styles from "./blocks.module.css";
import { useDocsLocale, type Localized } from "./locale";
import { ThemeSplit } from "./ThemeSplit";
import { useTokenValues } from "./useTokenValues";

export interface SwatchItem {
  token: string;
  name: Localized;
}

function SwatchList({ items }: { items: SwatchItem[] }) {
  const locale = useDocsLocale();
  const { ref, values } = useTokenValues<HTMLUListElement>(items.map((item) => item.token));
  return (
    <ul ref={ref} className={styles.swatchList}>
      {items.map((item) => (
        <li key={item.token} className={styles.swatch}>
          <span className={styles.chip} style={{ backgroundColor: `var(${item.token})` }} aria-hidden="true" />
          <span className={styles.swatchText}>
            <strong>{item.name[locale]}</strong>
            <code className={styles.code}>
              {item.token} · {values[item.token] ?? ""}
            </code>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Color swatches for a group of tokens in both themes. */
export function ColorSwatches({ items }: { items: SwatchItem[] }) {
  return <ThemeSplit>{() => <SwatchList items={items} />}</ThemeSplit>;
}
