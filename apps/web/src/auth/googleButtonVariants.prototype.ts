/*
 * PROTOTYPE (throwaway, branch prototype/google-button-styles): which look should Google's
 * official sign-in button have next to our email form, in light and dark themes?
 * Four looks on the existing /login route, switchable via ?variant=A|B|C|D.
 * Google's button is an iframe, so only these renderButton options can change it.
 */

export interface GoogleLook {
  name: string;
  theme: (appTheme: "light" | "dark") => NonNullable<GoogleButtonConfiguration["theme"]>;
  shape: NonNullable<GoogleButtonConfiguration["shape"]>;
  logoAlignment: NonNullable<GoogleButtonConfiguration["logo_alignment"]>;
  /** Stretch to the card's content width (Google caps it at 400px) instead of a fixed 300px. */
  fullWidth: boolean;
}

const current: GoogleLook = {
  name: "Current: follows theme, pill, 300px",
  theme: (t) => (t === "dark" ? "filled_black" : "outline"),
  shape: "pill",
  logoAlignment: "left",
  fullWidth: false,
};

export const googleLooks: Record<string, GoogleLook> = {
  A: current,
  B: {
    name: "Full-width rectangle, follows theme",
    theme: (t) => (t === "dark" ? "filled_black" : "outline"),
    shape: "rectangular",
    logoAlignment: "left",
    fullWidth: true,
  },
  C: {
    name: "Always light, full-width pill, centred logo",
    theme: () => "outline",
    shape: "pill",
    logoAlignment: "center",
    fullWidth: true,
  },
  D: {
    name: "Google blue, full-width rectangle",
    theme: () => "filled_blue",
    shape: "rectangular",
    logoAlignment: "left",
    fullWidth: true,
  },
};

export const lookFor = (variant: string | null): GoogleLook => googleLooks[variant ?? "A"] ?? current;
