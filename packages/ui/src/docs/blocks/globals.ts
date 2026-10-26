import { useEffect, useState } from "react";
import { GLOBALS_UPDATED, SET_GLOBALS } from "storybook/internal/core-events";
import { addons } from "storybook/preview-api";

interface GlobalsPayload {
  globals?: Record<string, unknown>;
}

function globalFrom(payload: unknown, name: string): unknown {
  // The channel stores the last emitted arguments, either as an array or as the payload itself.
  const data = (Array.isArray(payload) ? payload[0] : payload) as GlobalsPayload | undefined;
  return data?.globals?.[name];
}

function currentGlobal(name: string): unknown {
  const channel = addons.getChannel();
  return globalFrom(channel.last(GLOBALS_UPDATED), name) ?? globalFrom(channel.last(SET_GLOBALS), name);
}

/**
 * Value of a Storybook toolbar global (theme, locale…) for docs pages and the docs container.
 * Docs pages don't run story decorators, so they listen to the globals channel directly.
 * Returns `undefined` until the global is set; callers decide the fallback.
 */
export function useDocsGlobal(name: string): unknown {
  const [value, setValue] = useState<unknown>(() => currentGlobal(name));

  useEffect(() => {
    const channel = addons.getChannel();
    const onGlobals = (payload: unknown) => {
      const next = globalFrom(payload, name);
      if (next !== undefined) setValue(next);
    };
    channel.on(GLOBALS_UPDATED, onGlobals);
    channel.on(SET_GLOBALS, onGlobals);
    setValue(currentGlobal(name));
    return () => {
      channel.off(GLOBALS_UPDATED, onGlobals);
      channel.off(SET_GLOBALS, onGlobals);
    };
  }, [name]);

  return value;
}
