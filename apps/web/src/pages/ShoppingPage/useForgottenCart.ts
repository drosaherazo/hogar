import { useState } from "react";

type Seen = "loading" | "forgotten" | "none";

/**
 * Whether the viewer arrived at the list with things already in their cart: a cart left from
 * another visit, which the page reminds them to finish. A cart they fill during this visit isn't
 * forgotten (the bar at the bottom is enough), and once it empties the reminder is done.
 */
export function useForgottenCart(inMyCart: number, loaded: boolean): boolean {
  const [seen, setSeen] = useState<Seen>("loading");
  // Compared with what the last render saw, as React suggests for state that follows other state.
  let next = seen;
  if (seen === "loading" && loaded) next = inMyCart > 0 ? "forgotten" : "none";
  else if (seen === "forgotten" && inMyCart === 0) next = "none";
  if (next !== seen) setSeen(next);
  return next === "forgotten";
}
