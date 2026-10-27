import styles from "./blocks.module.css";
import { useDocsLocale, useLocalized, type Localized } from "./locale";
import { ThemeSplit } from "./ThemeSplit";

const SPACES = ["1", "2", "3", "4", "6", "8", "12"];
const RADII = ["sm", "md", "lg", "xl", "full"];
const SHADOWS = ["sm", "md", "lg"];
const FONT_SIZES: { token: string; sample: Localized }[] = [
  { token: "3xl", sample: { en: "Household balance", es: "Balance del hogar" } },
  { token: "2xl", sample: { en: "October expenses", es: "Gastos de octubre" } },
  { token: "xl", sample: { en: "Saturday groceries", es: "Compra del sábado" } },
  { token: "lg", sample: { en: "Ana owes you €12.50", es: "Ana te debe 12,50 €" } },
  { token: "md", sample: { en: "Wash the dishes before dinner", es: "Lavar los platos antes de cenar" } },
  { token: "sm", sample: { en: "Added by Marta 5 min ago", es: "Añadido por Marta hace 5 min" } },
  { token: "xs", sample: { en: "Last change: today", es: "Último cambio: hoy" } },
];
const MOTION_LABEL: Localized<(duration: string) => string> = {
  en: (duration) => `${duration} transition example: hover or focus to see it`,
  es: (duration) => `Ejemplo de transición ${duration}: pasa el ratón o enfoca para verla`,
};
const DURATIONS = [
  { duration: "fast", easing: "standard" },
  { duration: "base", easing: "gentle" },
  { duration: "slow", easing: "gentle" },
];

export function SpacingScale() {
  return (
    <div>
      {SPACES.map((space) => (
        <div key={space} className={styles.scaleRow}>
          <code className={styles.scaleLabel}>--space-{space}</code>
          <span className={styles.bar} style={{ inlineSize: `var(--space-${space})` }} />
        </div>
      ))}
    </div>
  );
}

export function RadiusScale() {
  return (
    <div className={styles.scaleRow}>
      {RADII.map((radius) => (
        <div key={radius}>
          <div className={styles.radiusBox} style={{ borderRadius: `var(--radius-${radius})` }} />
          <code className={styles.code}>{radius}</code>
        </div>
      ))}
    </div>
  );
}

export function ShadowScale() {
  return (
    <ThemeSplit>
      {() => (
        <div className={styles.scaleRow}>
          {SHADOWS.map((shadow) => (
            <div key={shadow}>
              <div className={styles.shadowBox} style={{ boxShadow: `var(--shadow-${shadow})` }} />
              <code className={styles.code}>--shadow-{shadow}</code>
            </div>
          ))}
        </div>
      )}
    </ThemeSplit>
  );
}

export function TypeScale() {
  const locale = useDocsLocale();
  return (
    <div>
      {FONT_SIZES.map(({ token, sample }) => (
        <div key={token} className={styles.scaleRow}>
          <code className={styles.scaleLabel}>--font-size-{token}</code>
          <span style={{ fontSize: `var(--font-size-${token})` }}>{sample[locale]}</span>
        </div>
      ))}
    </div>
  );
}

export function MotionScale() {
  const motionLabel = useLocalized(MOTION_LABEL);
  return (
    <div>
      {DURATIONS.map(({ duration, easing }) => (
        <div key={duration} className={styles.scaleRow}>
          <code className={styles.scaleLabel}>--duration-{duration}</code>
          <div className={styles.motionTrack} tabIndex={0} role="img" aria-label={motionLabel(duration)}>
            <span
              className={styles.motionDot}
              style={{
                transitionDuration: `var(--duration-${duration})`,
                transitionTimingFunction: `var(--easing-${easing})`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
