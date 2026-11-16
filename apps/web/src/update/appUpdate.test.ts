import { describe, expect, it, vi } from "vitest";
import type { RegisterSWOptions } from "vite-plugin-pwa/types";
import { fakeServiceWorker } from "../test/fakeServiceWorker";
import { createAppUpdate } from "./appUpdate";

/** A registration whose update check finds `incoming` (a new version still downloading), or nothing. */
function registrationFinding(incoming: ServiceWorker | null) {
  return {
    installing: incoming,
    waiting: null,
    update: vi.fn(() => Promise.resolve()),
  } as unknown as ServiceWorkerRegistration;
}

function downloadingWorker() {
  const worker = new EventTarget() as EventTarget & { state: ServiceWorkerState };
  worker.state = "installing";
  return worker as unknown as ServiceWorker & { state: ServiceWorkerState };
}

describe("createAppUpdate", () => {
  it("reloads only the window where the person pressed Update, never the others", async () => {
    const here = fakeServiceWorker();
    const elsewhere = fakeServiceWorker();
    here.arrive();
    elsewhere.arrive();

    await here.update.apply();
    here.takeOver();
    elsewhere.takeOver();
    expect(here.reload).toHaveBeenCalledOnce();
    expect(elsewhere.reload).not.toHaveBeenCalled();
  });

  it("with nothing waiting, looks for a new version and hands over once it has downloaded", async () => {
    let options: RegisterSWOptions = {};
    const handOver = vi.fn(() => Promise.resolve());
    const reload = vi.fn();
    const update = createAppUpdate({
      registerSW: (registered) => {
        options = registered;
        return handOver;
      },
      reload,
    });
    const incoming = downloadingWorker();
    const registration = registrationFinding(incoming);
    options.onRegisteredSW?.("/sw.js", registration);

    const applying = update.apply();
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalled());
    options.onNeedRefresh?.();
    await applying;
    expect(handOver).toHaveBeenCalledWith(true);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads when there is no new version to wait for, or no service worker at all", async () => {
    let options: RegisterSWOptions = {};
    const reload = vi.fn();
    const update = createAppUpdate({
      registerSW: (registered) => {
        options = registered;
        return () => Promise.resolve();
      },
      reload,
    });
    await update.apply();
    expect(reload).toHaveBeenCalledTimes(1);

    options.onRegisteredSW?.("/sw.js", registrationFinding(null));
    await update.apply();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("reloads once a first install takes over, since nothing will wait", async () => {
    let options: RegisterSWOptions = {};
    const reload = vi.fn();
    const update = createAppUpdate({
      registerSW: (registered) => {
        options = registered;
        return () => Promise.resolve();
      },
      reload,
    });
    const incoming = downloadingWorker();
    const registration = registrationFinding(incoming);
    options.onRegisteredSW?.("/sw.js", registration);

    const applying = update.apply();
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalled());
    incoming.state = "activated";
    incoming.dispatchEvent(new Event("statechange"));
    await applying;
    expect(reload).toHaveBeenCalledOnce();
  });
});
