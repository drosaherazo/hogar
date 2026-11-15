import { Amount } from "@hogar/ui";
import { useCurrency } from "../i18n/format";

/** A standalone amount (minor units) in the household's currency. */
export function Money({ units, className }: { units: number; className?: string | undefined }) {
  return <Amount units={units} currency={useCurrency()} className={className} />;
}
