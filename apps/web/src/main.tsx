import "@hogar/ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createI18n } from "./i18n";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");

const googleClientId = import.meta.env["VITE_GOOGLE_CLIENT_ID"]?.trim() || undefined;

createRoot(root).render(
  <StrictMode>
    <App i18n={createI18n()} config={{ googleClientId }} />
  </StrictMode>,
);
