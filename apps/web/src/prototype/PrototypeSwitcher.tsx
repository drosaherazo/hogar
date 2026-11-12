import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router";
import styles from "./PrototypeSwitcher.module.css";

export interface PrototypeSwitcherProps {
  variants: { key: string; name: string }[];
  current: string;
}

/** PROTOTYPE: floating bar that cycles ?variant= with the arrows or the ← → keys. */
export function PrototypeSwitcher({ variants, current }: PrototypeSwitcherProps) {
  const [, setParams] = useSearchParams();
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );

  const go = useCallback(
    (step: number) => {
      const next = variants[(index + step + variants.length) % variants.length];
      if (!next) return;
      setParams(
        (params) => {
          params.set("variant", next.key);
          return params;
        },
        { replace: true },
      );
    },
    [index, variants, setParams],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const active = variants[index];
  if (!active) return null;
  const { key, name } = active;
  return (
    <div className={styles.bar} role="toolbar" aria-label="Prototype variants">
      <button type="button" className={styles.arrow} onClick={() => go(-1)} aria-label="Previous variant">
        ←
      </button>
      <span className={styles.label}>
        {key} ({name})
      </span>
      <button type="button" className={styles.arrow} onClick={() => go(1)} aria-label="Next variant">
        →
      </button>
    </div>
  );
}
