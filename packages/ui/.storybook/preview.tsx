import { DocsContainer, type DocsContainerProps } from "@storybook/addon-docs/blocks";
import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect, type PropsWithChildren } from "react";
import { useDocsGlobal } from "../src/docs/blocks/globals";
import { DEFAULT_LOCALE, isLocale, LocaleProvider, type Locale } from "../src/locale/LocaleProvider";
import "../src/tokens/index.css";
import { resolveThemeName, storybookThemes, type ThemeName } from "./themes";

function useThemeAttribute(theme: ThemeName) {
  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);
}

function ThemeScope({ theme, children }: PropsWithChildren<{ theme: ThemeName }>) {
  useThemeAttribute(theme);
  return children;
}

function LocaleScope({ locale, children }: PropsWithChildren<{ locale: Locale }>) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}

const withTheme: Decorator = (Story, context) => (
  <ThemeScope theme={resolveThemeName(context.globals["theme"])}>
    <Story />
  </ThemeScope>
);

const withLocale: Decorator = (Story, context) => {
  const requested: unknown = context.globals["locale"];
  return (
    <LocaleScope locale={isLocale(requested) ? requested : DEFAULT_LOCALE}>
      <Story />
    </LocaleScope>
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
