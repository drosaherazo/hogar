import { Alert, Button } from "@hogar/ui";
import { useTranslation } from "react-i18next";
import { errorKey } from "../api/client";

/** Friendly failure state for household data, with a way to try again. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation(["household", "errors"]);
  return (
    <Alert
      tone="danger"
      title={t("loadError")}
      action={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      }
    >
      {t(errorKey(error))}
    </Alert>
  );
}
