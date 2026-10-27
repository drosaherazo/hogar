import { LocaleProvider } from "@hogar/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { i18n as I18n } from "i18next";
import { useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router";
import { ApiClient } from "./api/client";
import { AuthProvider } from "./auth/AuthProvider";
import { RedirectIfAuthenticated, RequireAuth } from "./auth/guards";
import { currentLocale } from "./i18n";
import { HomePage } from "./pages/HomePage/HomePage";
import { LoginPage } from "./pages/LoginPage/LoginPage";

export interface AppConfig {
  googleClientId: string | undefined;
}

export function createRoutes({ googleClientId }: AppConfig): RouteObject[] {
  return [
    {
      element: <RedirectIfAuthenticated />,
      children: [{ path: "/login", element: <LoginPage googleClientId={googleClientId} /> }],
    },
    {
      element: <RequireAuth />,
      children: [{ path: "/", element: <HomePage /> }],
    },
    { path: "*", element: <RedirectIfAuthenticated /> },
  ];
}

/** Feeds the active i18next language to the design system's formatting components. */
function UiLocale({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  return <LocaleProvider locale={currentLocale(i18n.resolvedLanguage)}>{children}</LocaleProvider>;
}

export interface AppProvidersProps {
  i18n: I18n;
  client: ApiClient;
  children: React.ReactNode;
}

export function AppProviders({ i18n, client, children }: AppProvidersProps) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <I18nextProvider i18n={i18n}>
      <UiLocale>
        <QueryClientProvider client={queryClient}>
          <AuthProvider client={client}>{children}</AuthProvider>
        </QueryClientProvider>
      </UiLocale>
    </I18nextProvider>
  );
}

export function App({ i18n, config }: { i18n: I18n; config: AppConfig }) {
  const [client] = useState(() => new ApiClient());
  const [router] = useState(() => createBrowserRouter(createRoutes(config)));
  return (
    <AppProviders i18n={i18n} client={client}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
