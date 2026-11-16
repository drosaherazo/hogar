import "@hogar/ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createI18n } from "./i18n";
import { createInstallPrompt, runsOnIOS } from "./install/installPrompt";
import { runsInstalled } from "./offline/offlineCache";
import { registerAppUpdate } from "./update/registerAppUpdate";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");

// Before React starts: the browser may offer installing Hogar as soon as the page loads.
const install = createInstallPrompt({ target: window, isInstalled: runsInstalled, isIOS: runsOnIOS });

const googleClientId = import.meta.env["VITE_GOOGLE_CLIENT_ID"]?.trim() || undefined;

createRoot(root).render(
  <StrictMode>
    <App i18n={createI18n()} config={{ googleClientId }} update={registerAppUpdate()} install={install} />
  </StrictMode>,
);
