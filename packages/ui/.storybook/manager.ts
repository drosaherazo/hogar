import { GLOBALS_UPDATED, SET_GLOBALS } from "storybook/internal/core-events";
import { addons } from "storybook/manager-api";
import { resolveThemeName, storybookThemes } from "./themes";

// Start with the system preference so the chrome doesn't flash the wrong theme before globals arrive.
addons.setConfig({ theme: storybookThemes[resolveThemeName(undefined)] });

/** Keeps Storybook's own interface in sync with the Theme toolbar. */
addons.register("hogar/theme", (api) => {
  let current: unknown;

  const apply = (value: unknown) => {
    const name = resolveThemeName(value);
    if (name === current) return;
    current = name;
    api.setOptions({ theme: storybookThemes[name] });
  };

  const onGlobals = ({ globals }: { globals?: Record<string, unknown> }) => apply(globals?.["theme"]);

  api.on(SET_GLOBALS, onGlobals);
  api.on(GLOBALS_UPDATED, onGlobals);
  apply(api.getGlobals()["theme"]);
});
