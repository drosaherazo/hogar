const SCRIPT_URL = "https://accounts.google.com/gsi/client";

let loading: Promise<void> | null = null;

/** Loads Google Identity Services once and resolves when `window.google.accounts.id` is ready. */
export function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Google Identity Services failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
