import { GLOBALS_UPDATED, SET_GLOBALS } from "storybook/internal/core-events";
import { addons } from "storybook/manager-api";
import { resolveThemeName, sidebarIconColors, storybookThemes, type ThemeName } from "./themes";

// Start with the system preference so the chrome doesn't flash the wrong theme before globals arrive.
addons.setConfig({ theme: storybookThemes[resolveThemeName(undefined)] });

/**
 * Repaints the sidebar's story and docs icons, which Storybook colors outside its theme API.
 * The selected item keeps Storybook's own contrast color on the highlighted row.
 */
const sidebarIcons = document.createElement("style");
document.head.append(sidebarIcons);
function paintSidebarIcons(name: ThemeName) {
  const { story, document: docs } = sidebarIconColors[name];
  sidebarIcons.textContent = `
    .sidebar-item[data-selected="false"] svg[type="story"] { color: ${story}; }
    .sidebar-item[data-selected="false"] svg[type="document"] { color: ${docs}; }`;
}

/** Keeps Storybook's own interface in sync with the Theme toolbar. */
addons.register("hogar/theme", (api) => {
  let current: unknown;

  const apply = (value: unknown) => {
    const name = resolveThemeName(value);
    if (name === current) return;
    current = name;
    api.setOptions({ theme: storybookThemes[name] });
    paintSidebarIcons(name);
  };

  const onGlobals = ({ globals }: { globals?: Record<string, unknown> }) => apply(globals?.["theme"]);

  api.on(SET_GLOBALS, onGlobals);
  api.on(GLOBALS_UPDATED, onGlobals);
  apply(api.getGlobals()["theme"]);
});
