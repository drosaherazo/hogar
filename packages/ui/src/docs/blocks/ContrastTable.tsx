import { contrastRatio } from "../../tokens/contrast";
import { contrastPairs } from "../../tokens/contrastPairs";
import styles from "./blocks.module.css";
import { useDocsLocale, type Localized } from "./locale";
import { ThemeSplit } from "./ThemeSplit";
import { useTokenValues } from "./useTokenValues";

const tokens = [...new Set(contrastPairs.flatMap((pair) => [pair.foreground, pair.background]))];

const LABELS: Localized<{ usage: string; sample: string; ratio: string; minimum: string }> = {
  en: { usage: "Usage", sample: "Sample", ratio: "Ratio", minimum: "min." },
  es: { usage: "Uso", sample: "Muestra", ratio: "Ratio", minimum: "mín." },
};

function Table() {
  const locale = useDocsLocale();
  const labels = LABELS[locale];
  const format = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { ref, values } = useTokenValues<HTMLTableElement>(tokens);
  return (
    <table ref={ref} className={styles.table}>
      <thead>
        <tr>
          <th scope="col">{labels.usage}</th>
          <th scope="col">{labels.sample}</th>
          <th scope="col">{labels.ratio}</th>
        </tr>
      </thead>
      <tbody>
        {contrastPairs.map((pair) => {
          const foreground = values[pair.foreground];
          const background = values[pair.background];
          const ratio = foreground && background ? contrastRatio(foreground, background) : undefined;
          const passes = ratio !== undefined && ratio >= pair.minimum;
          return (
            <tr key={`${pair.foreground}-${pair.background}`}>
              <td>{pair.usage[locale]}</td>
              <td>
                <span
                  className={styles.sample}
                  style={{ color: `var(${pair.foreground})`, backgroundColor: `var(${pair.background})` }}
                >
                  Aa
                </span>
              </td>
              <td className={passes ? styles.pass : styles.fail}>
                {ratio === undefined ? "…" : `${format.format(ratio)} ${passes ? "✓" : "✗"}`}
                <span className={styles.code}>
                  {" "}
                  ({labels.minimum} {format.format(pair.minimum)})
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Contrast table computed live from each theme's tokens. */
export function ContrastTable() {
  return <ThemeSplit>{() => <Table />}</ThemeSplit>;
}
