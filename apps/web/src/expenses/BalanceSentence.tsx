import { useTranslation } from "react-i18next";
import { useMoney } from "../i18n/format";

/**
 * The viewer's overall balance in one sentence: "You owe €10.70 in total", "You're owed €10.70
 * in total" or "You're all square". Always in words, never a bare sign.
 */
export function useBalanceSentence() {
  const { t } = useTranslation("expenses");
  const money = useMoney();
  return (cents: number) =>
    cents < 0
      ? t("balances.youOwe", { amount: money(-cents) })
      : cents > 0
        ? t("balances.youAreOwed", { amount: money(cents) })
        : t("balances.youAreSquare");
}

export function BalanceSentence({ cents, className }: { cents: number; className?: string | undefined }) {
  const sentence = useBalanceSentence();
  return <p className={className}>{sentence(cents)}</p>;
}
