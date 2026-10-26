import { DocsContainer, type DocsContainerProps } from "@storybook/addon-docs/blocks";
import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect, type PropsWithChildren } from "react";
import { useDocsGlobal } from "../src/docs/blocks/globals";
import { DEFAULT_LOCALE, isLocale, LocaleProvider } from "../src/locale/LocaleProvider";
import "../src/tokens/index.css";
import { resolveThemeName, storybookThemes, type ThemeName } from "./themes";

function useThemeAttribute(theme: ThemeName) {
  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);
}

const withTheme: Decorator = (Story, context) => {
  const theme = resolveThemeName(context.globals["theme"]);
  useThemeAttribute(theme);
  return <Story />;
};

const withLocale: Decorator = (Story, context) => {
  const requested: unknown = context.globals["locale"];
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <LocaleProvider locale={locale}>
      <Story />
    </LocaleProvider>
  );
};

/** Docs pages use the Hogar brand theme and follow the Theme toolbar, like the canvas and the chrome. */
function HogarDocsContainer({ children, context }: PropsWithChildren<DocsContainerProps>) {
  const theme = resolveThemeName(useDocsGlobal("theme"));
  useThemeAttribute(theme);
  return (
    <DocsContainer context={context} theme={storybookThemes[theme]}>
      {children}
    </DocsContainer>
  );
}

const preview: Preview = {
  decorators: [withTheme, withLocale],
  globalTypes: {
    theme: {
      description: "Color theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: "Locale for formatting and story copy",
      toolbar: {
        title: "Locale",
        icon: "globe",
        items: [
          { value: "en", title: "English" },
          { value: "es", title: "Español" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: resolveThemeName(undefined), locale: DEFAULT_LOCALE },
  parameters: {
    a11y: { test: "error" },
    // The canvas background comes from our tokens (base.css), not from the backgrounds addon.
    backgrounds: { disable: true },
    controls: { expanded: true },
    docs: {
      container: HogarDocsContainer,
      theme: storybookThemes.light,
    },
    options: {
      storySort: {
        order: [
          "Foundations",
          ["Introduction", "Color", "Typography", "Spacing and shape", "Motion and tone", "Documenting a component"],
          "Components",
        ],
      },
    },
  },
};

export default preview;
