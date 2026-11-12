import { Button, WakeUpScreen } from "@hogar/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import { isRevealed, stageAt, TIP_IDS, tipIndexAt } from "../startup/wakeUp";

/** Re-reads the clock every second, so stages and tips follow real elapsed time. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * Shown while we find out whether someone is signed in, which can mean waiting for the server to
 * wake up. Every branch renders the same WakeUpScreen, so its live region stays mounted from the
 * start and each new status is announced.
 */
export function WakeUpLoading() {
  const { state, retry } = useAuth();
  const { t } = useTranslation();
  const now = useNow();
  if (state.status !== "loading") return null;

  if (state.phase === "slow") {
    return (
      <WakeUpScreen
        mood="resting"
        status={t("wakeUp.slow.title")}
        description={t("wakeUp.slow.description")}
        action={<Button onClick={retry}>{t("wakeUp.retry")}</Button>}
      />
    );
  }

  if (state.phase === "offline") {
    return (
      <WakeUpScreen mood="resting" status={t("wakeUp.offline.title")} description={t("wakeUp.offline.description")} />
    );
  }

  const elapsed = Math.max(0, now - state.startedAt);
  const tipId = TIP_IDS[tipIndexAt(elapsed, TIP_IDS.length)] ?? TIP_IDS[0];
  return (
    <WakeUpScreen
      revealed={isRevealed(elapsed, state.attempt)}
      status={t(`wakeUp.stage.${stageAt(elapsed).id}`)}
      description={t("wakeUp.description")}
      tipLabel={t("wakeUp.tipLabel")}
      tip={t(`wakeUp.tips.${tipId}`)}
    />
  );
}
