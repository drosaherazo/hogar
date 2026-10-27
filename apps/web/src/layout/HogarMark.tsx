import { useTheme } from "../theme/theme";
import styles from "./HogarMark.module.css";

/** The Hogar house mark. Decorative: the app name is always written next to it. */
export function HogarMark({ size = "md" }: { size?: "md" | "lg" }) {
  const { theme } = useTheme();
  return (
    <img
      className={size === "lg" ? styles.lg : styles.md}
      src={theme === "dark" ? "/hogar-mark-dark.svg" : "/hogar-mark-light.svg"}
      alt=""
    />
  );
}
