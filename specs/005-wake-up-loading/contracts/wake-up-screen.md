# Contract: `WakeUpScreen` (`packages/ui`)

A full-page, copy-free scene shown while Hogar waits for its server. Exported from
`@hogar/ui` next to the other components.

```ts
export interface WakeUpScreenProps {
  /** Current status, already translated. Rendered as the page's h1 inside a polite live region. */
  status: string;
  /** Why it is happening and what to expect. Not part of the live region. */
  description?: ReactNode;
  /** Visible label above the tip ("Quick tip"). Required when `tip` is set. */
  tipLabel?: string;
  /** One short tip. Not announced when it changes. Fades in on change (no motion when reduced). */
  tip?: string;
  /** Next step, usually one Button ("Try again"). */
  action?: ReactNode;
  /** `waking` animates the house; `resting` shows it still (slow and offline states). Default `waking`. */
  mood?: "waking" | "resting";
  /** `false` renders a calm, empty page that already holds the empty live region. Default `true`. */
  revealed?: boolean;
  className?: string;
}
```

## Behaviour

- Renders `<main aria-busy="true">` (`aria-busy` only when `mood === "waking"`) centred in the
  viewport (`min-block-size: 100dvh`), with the illustration first, then status, description, tip
  and action.
- The illustration is decorative (`aria-hidden="true"`), drawn inline with semantic tokens only.
- The status lives in `role="status"`; changing `status` announces only the new heading text.
- With `revealed={false}` only the empty `role="status"` region is rendered (no illustration, heading, description, tip or action). The app renders the same instance from the first frame, so the region is already on the page when the first status arrives; screen readers often skip live regions that appear already filled.
- Changing `tip` re-keys its element so the fade-in replays; base.css removes the motion under
  `prefers-reduced-motion`.
- No fixed widths on text; fits 320 px and 200 % zoom without horizontal scrolling.

## Required tests (`WakeUpScreen.test.tsx`)

- Renders status as an h1 inside `role="status"`; description and tip are outside it.
- No axe violations in the `waking` (with tip), `slow` (resting with action) and `offline` (resting,
  no action) configurations.
- `mood="resting"` drops `aria-busy` and the animated class.
- The action is rendered and reachable by keyboard.

## Stories and docs

- Stories: `Waking`, `WakingSpanish` (longer copy), `Slow`, `Offline`, all following the Theme and
  Locale toolbars.
- `WakeUpScreen.mdx` in `en` and `es` with the five-section template (what and when · why it's
  designed this way · how it helps the person · accessibility · variants).
