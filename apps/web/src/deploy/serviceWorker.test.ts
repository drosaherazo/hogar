import { describe, expect, it } from "vitest";
import { pwaOptions } from "../../pwa.config";
import vercelConfig from "../../vercel.json";

const { manifest, workbox } = pwaOptions;

describe("the installable app", () => {
  it("never answers an /api address from the service worker", () => {
    // No runtime routes: nothing the API answers is ever cached.
    expect(workbox?.runtimeCaching).toBeUndefined();
    const denied = (path: string) => workbox?.navigateFallbackDenylist?.some((pattern) => pattern.test(path));
    expect(denied("/api/auth/refresh")).toBe(true);
    expect(denied("/api/household")).toBe(true);
    expect(denied("/expenses")).toBe(false);
  });

  it("only takes over once the person accepts the update, and stays off in development", () => {
    expect(pwaOptions.registerType).toBe("prompt");
    expect(pwaOptions.devOptions?.enabled).toBe(false);
  });

  it("installs as Hogar, in its own window, in any orientation, with an icon for every launcher", () => {
    expect(manifest).toMatchObject({
      name: "Hogar",
      short_name: "Hogar",
      display: "standalone",
      start_url: "/",
      scope: "/",
    });
    expect(manifest && "orientation" in manifest).toBe(false);
    expect(manifest && manifest.icons?.map((icon) => `${icon.sizes} ${icon.purpose ?? "any"}`)).toEqual(
      expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]),
    );
  });

  it("is served fresh by Vercel, so a new version is found as soon as it ships", () => {
    const rule = vercelConfig.headers.find((entry) => entry.source === "/sw.js");
    expect(rule?.headers).toContainEqual({ key: "Cache-Control", value: "public, max-age=0, must-revalidate" });
  });
});
