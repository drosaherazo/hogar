import { Alert, Button } from "@hogar/ui";
import { useTranslation } from "react-i18next";
import { errorKey } from "../api/client";

/** Friendly failure state for loading data, with a way to try again. Defaults to the household's wording. */
export function LoadError({ error, onRetry, title }: { error: unknown; onRetry: () => void; title?: string }) {
  const { t } = useTranslation(["household", "errors"]);
  return (
    <Alert
      tone="danger"
      title={title ?? t("loadError")}
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
