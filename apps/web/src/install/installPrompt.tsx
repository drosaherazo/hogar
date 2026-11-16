import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

/** Chrome and Edge's install event: the native install dialog, kept until the person asks for it. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** How Hogar can be installed here: the browser's own dialog, the iOS steps, or not at all. */
export type InstallWay = "native" | "ios" | "none";

export interface InstallPrompt {
  readonly way: InstallWay;
  onChange(listener: () => void): () => void;
  /** Opens the browser's install dialog. Only meaningful when `way` is "native". */
  promptNative(): Promise<void>;
}

export interface InstallPromptOptions {
  /** Where the browser fires `beforeinstallprompt` and `appinstalled`: the window. */
  target: EventTarget;
  /** Already running installed: nothing to offer. */
  isInstalled: () => boolean;
  /** iOS, in any browser: no install event, but Share › Add to Home Screen works since iOS 16.4. */
  isIOS: () => boolean;
}

/** iPhone, iPod or iPad (iPadOS says it is a Mac, but a Mac has no touch screen). */
export function runsOnIOS(): boolean {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

/**
 * Keeps track of whether Hogar can be installed, for the account menu's "Install Hogar". Created
 * before React starts, since the browser may fire its install event early. The event's default is
 * prevented so no browser banner pushes anyone to install: it opens only from the menu.
 */
export function createInstallPrompt({ target, isInstalled, isIOS }: InstallPromptOptions): InstallPrompt {
  let deferred: BeforeInstallPromptEvent | null = null;
  let installed = isInstalled();
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());

  target.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    changed();
  });
  target.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    changed();
  });

  return {
    get way(): InstallWay {
      if (installed) return "none";
      if (deferred) return "native";
      return isIOS() ? "ios" : "none";
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async promptNative() {
      const event = deferred;
      if (!event) return;
      // The browser lets each install event open its dialog once.
      deferred = null;
      changed();
      await event.prompt();
    },
  };
}

const InstallPromptContext = createContext<InstallPrompt | null>(null);

export function InstallPromptProvider({ prompt, children }: { prompt: InstallPrompt; children: ReactNode }) {
  return <InstallPromptContext.Provider value={prompt}>{children}</InstallPromptContext.Provider>;
}

/** How Hogar can be installed right now, kept up to date. */
export function useInstallPrompt(): { way: InstallWay; promptNative: () => Promise<void> } {
  const prompt = useContext(InstallPromptContext);
  if (!prompt) throw new Error("useInstallPrompt must be used inside <InstallPromptProvider>");
  const subscribe = useCallback((onChange: () => void) => prompt.onChange(onChange), [prompt]);
  const way = useSyncExternalStore(subscribe, () => prompt.way);
  return { way, promptNative: () => prompt.promptNative() };
}
