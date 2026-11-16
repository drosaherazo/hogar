import { registerSW } from "virtual:pwa-register";
import { createAppUpdate, type AppUpdate } from "./appUpdate";

/** The real service worker; kept out of appUpdate.tsx so tests never load the virtual module. */
export function registerAppUpdate(): AppUpdate {
  return createAppUpdate({ registerSW });
}
