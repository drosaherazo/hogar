import { useLayoutEffect, useRef, useState } from "react";

/** Reads the resolved value of several tokens in the element's theme context. */
export function useTokenValues<T extends HTMLElement>(tokens: string[]) {
  const ref = useRef<T>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const key = tokens.join("|");

  useLayoutEffect(() => {
    if (!ref.current) return;
    const computed = getComputedStyle(ref.current);
    setValues(Object.fromEntries(key.split("|").map((token) => [token, computed.getPropertyValue(token).trim()])));
  }, [key]);

  return { ref, values };
}
