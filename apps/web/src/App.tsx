import { formattingLocale } from "@hogar/shared";
import { LocaleProvider } from "@hogar/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { i18n as I18n } from "i18next";
import { useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router";
import { ApiClientProvider } from "./api/ApiClientContext";
import { ApiClient } from "./api/client";
import { AuthProvider } from "./auth/AuthProvider";
import { RedirectIfAuthenticated, RequireAuth } from "./auth/guards";
import { currentLocale } from "./i18n";
import { createOfflineCache, runsInstalled, type OfflineCacheOptions } from "./offline/offlineCache";
import { BalancesPage } from "./pages/BalancesPage/BalancesPage";
import { ExpenseDetailPage } from "./pages/ExpenseDetailPage/ExpenseDetailPage";
import { ExpenseFormPage } from "./pages/ExpenseFormPage/ExpenseFormPage";
import { ExpensesPage } from "./pages/ExpensesPage/ExpensesPage";
import { HomePage } from "./pages/HomePage/HomePage";
import { HouseholdSettingsPage } from "./pages/HouseholdSettingsPage/HouseholdSettingsPage";
import { InvitePage } from "./pages/InvitePage/InvitePage";
import { LoginPage } from "./pages/LoginPage/LoginPage";
import { AppUpdateProvider, type AppUpdate } from "./update/appUpdate";
import { RequiredUpdateGate } from "./update/RequiredUpdate";

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
      children: [
        { path: "/", element: <HomePage /> },
        { path: "/household/settings", element: <HouseholdSettingsPage /> },
        { path: "/invite", element: <InvitePage /> },
        { path: "/expenses", element: <ExpensesPage /> },
        { path: "/expenses/new", element: <ExpenseFormPage /> },
        { path: "/expenses/:id", element: <ExpenseDetailPage /> },
        { path: "/expenses/:id/edit", element: <ExpenseFormPage /> },
        { path: "/balances", element: <BalancesPage /> },
      ],
    },
    { path: "*", element: <RedirectIfAuthenticated /> },
  ];
}

/**
 * Feeds the active i18next language to the design system, plus the formatting locale: that language
 * with the device's region when the device speaks it ("es-CO"), so money, dates and numbers look the
 * way each person writes them.
 */
function UiLocale({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const locale = currentLocale(i18n.resolvedLanguage);
  return (
    <LocaleProvider locale={locale} formattingLocale={formattingLocale(locale, navigator.languages)}>
      {children}
    </LocaleProvider>
  );
}

export interface AppProvidersProps {
  i18n: I18n;
  client: ApiClient;
  /** Where the installed app keeps the last data it saw, and how to tell it is installed. */
  offline: OfflineCacheOptions;
  /** New versions of Hogar from the service worker, for the update notice and the required update. */
  update: AppUpdate;
  children: React.ReactNode;
}

export function AppProviders({ i18n, client, offline, update, children }: AppProvidersProps) {
  const [{ queryClient, offlineCache }] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
    return { queryClient, offlineCache: createOfflineCache(offline, queryClient) };
  });
  const session = (
    <ApiClientProvider client={client}>
      <AuthProvider client={client} offline={offlineCache}>
        {children}
      </AuthProvider>
    </ApiClientProvider>
  );
  return (
    <I18nextProvider i18n={i18n}>
      <UiLocale>
        <AppUpdateProvider update={update}>
          <RequiredUpdateGate client={client} onUpdate={() => void update.apply()}>
            {offlineCache.persistOptions ? (
              <PersistQueryClientProvider client={queryClient} persistOptions={offlineCache.persistOptions}>
                {session}
              </PersistQueryClientProvider>
            ) : (
              <QueryClientProvider client={queryClient}>{session}</QueryClientProvider>
            )}
          </RequiredUpdateGate>
        </AppUpdateProvider>
      </UiLocale>
    </I18nextProvider>
  );
}

const thisDevice: OfflineCacheOptions = { storage: () => window.localStorage, isInstalled: runsInstalled };

export function App({ i18n, config, update }: { i18n: I18n; config: AppConfig; update: AppUpdate }) {
  const [client] = useState(() => new ApiClient());
  const [router] = useState(() => createBrowserRouter(createRoutes(config)));
  return (
    <AppProviders i18n={i18n} client={client} offline={thisDevice} update={update}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
