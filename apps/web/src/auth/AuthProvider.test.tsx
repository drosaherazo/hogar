import type { AuthResponse } from "@hogar/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ApiRequestError, type ApiClient } from "../api/client";
import { createI18n } from "../i18n";
import { ana, session } from "../test/server";
import { AuthProvider, useAuth, type AuthContextValue } from "./AuthProvider";

const unavailable = () => new ApiRequestError("server.unexpected", 503);
const noSession = () => new ApiRequestError("auth.session.missing", 401);

interface FakeClient {
  health: Mock<(signal?: AbortSignal) => Promise<void>>;
  refresh: Mock<() => Promise<AuthResponse>>;
  onSessionExpired: Mock<(listener: () => void) => () => void>;
  loginWithGoogle: Mock<() => Promise<AuthResponse>>;
  logout: Mock<() => Promise<void>>;
}

function fakeClient(): FakeClient {
  return {
    health: vi.fn(() => Promise.resolve()),
    refresh: vi.fn(() => Promise.resolve(session())),
    onSessionExpired: vi.fn(() => () => undefined),
    loginWithGoogle: vi.fn(() => Promise.resolve(session())),
    logout: vi.fn(() => Promise.resolve()),
  };
}

let auth: AuthContextValue;

/** Shows the state and hands the context to the test after each render. */
function Probe({ onValue }: { onValue: (value: AuthContextValue) => void }) {
  const value = useAuth();
  useEffect(() => onValue(value));
  const { state } = value;
  return <output>{state.status === "loading" ? `loading:${state.phase}:${state.attempt}` : state.status}</output>;
}

function renderProvider(client: FakeClient) {
  return render(
    <I18nextProvider i18n={createI18n({ lng: "en" })}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider client={client as unknown as ApiClient}>
          <Probe
            onValue={(value) => {
              auth = value;
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const shown = () => screen.getByRole("status").textContent;
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

function setOnline(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
}

describe("AuthProvider startup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-11T10:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts waiting on the first attempt, from now", () => {
    renderProvider(fakeClient());
    expect(auth.state).toMatchObject({
      status: "loading",
      phase: "waking",
      attempt: 0,
      startedAt: Date.parse("2026-11-11T10:00:00Z"),
    });
  });

  it("checks the server is awake before restoring the session", async () => {
    const client = fakeClient();
    const order: string[] = [];
    client.health.mockImplementation(() => {
      order.push("health");
      return Promise.resolve();
    });
    client.refresh.mockImplementation(() => {
      order.push("refresh");
      return Promise.resolve(session());
    });
    renderProvider(client);
    await advance(0);
    expect(shown()).toBe("authenticated");
    expect(auth.state.user).toEqual(ana);
    expect(order).toEqual(["health", "refresh"]);
  });

  it("keeps waiting through a cold start and refreshes exactly once, after the server answers", async () => {
    const client = fakeClient();
    client.health
      .mockRejectedValueOnce(unavailable())
      .mockRejectedValueOnce(unavailable())
      .mockRejectedValueOnce(unavailable())
      .mockResolvedValue(undefined);
    renderProvider(client);

    await advance(4000);
    expect(shown()).toBe("loading:waking:0");
    expect(client.refresh).not.toHaveBeenCalled();
    await advance(2000);
    expect(shown()).toBe("authenticated");
    expect(client.health).toHaveBeenCalledTimes(4);
    expect(client.refresh).toHaveBeenCalledOnce();
  });

  it("goes to the login page when the awake server says there is no session", async () => {
    const client = fakeClient();
    client.refresh.mockRejectedValue(noSession());
    renderProvider(client);
    await advance(0);
    expect(shown()).toBe("anonymous");
  });

  it("never signs anyone out because a refresh failed while the server was starting", async () => {
    const client = fakeClient();
    client.health.mockResolvedValueOnce(undefined).mockRejectedValueOnce(unavailable()).mockResolvedValue(undefined);
    client.refresh.mockRejectedValueOnce(unavailable()).mockResolvedValue(session());
    renderProvider(client);

    await advance(0);
    expect(shown()).toBe("loading:waking:0");
    expect(client.health).toHaveBeenCalledTimes(1);
    expect(client.refresh).toHaveBeenCalledTimes(1);

    // Two seconds later it checks the server again (still starting), then two more until it's up.
    await advance(2000);
    expect(shown()).toBe("loading:waking:0");
    expect(client.health).toHaveBeenCalledTimes(2);
    await advance(2000);
    expect(shown()).toBe("authenticated");
    expect(client.health).toHaveBeenCalledTimes(3);
    expect(client.refresh).toHaveBeenCalledTimes(2);
  });

  it("keeps a scene that was just revealed on screen for at least half a second", async () => {
    const client = fakeClient();
    client.refresh.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(session()), 1200)));
    renderProvider(client);
    await advance(1200);
    expect(shown()).toBe("loading:waking:0");
    await advance(299);
    expect(shown()).toBe("loading:waking:0");
    await advance(1);
    expect(shown()).toBe("authenticated");
  });

  it("leaves straight away when the answer comes before the scene is shown", async () => {
    const client = fakeClient();
    client.refresh.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(session()), 300)));
    renderProvider(client);
    await advance(300);
    expect(shown()).toBe("authenticated");
  });

  it("stops polling when unmounted", async () => {
    const client = fakeClient();
    client.health.mockRejectedValue(unavailable());
    const { unmount } = renderProvider(client);
    await advance(0);
    unmount();
    await advance(60_000);
    expect(client.health).toHaveBeenCalledTimes(1);
  });
});

describe("AuthProvider when waking goes wrong", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("offers to try again after 90 seconds and stops polling until asked", async () => {
    const client = fakeClient();
    client.health.mockRejectedValue(unavailable());
    renderProvider(client);

    await advance(89_999);
    expect(shown()).toBe("loading:waking:0");
    await advance(1);
    expect(shown()).toBe("loading:slow:0");
    const calls = client.health.mock.calls.length;
    await advance(60_000);
    expect(client.health).toHaveBeenCalledTimes(calls);

    client.health.mockResolvedValue(undefined);
    client.refresh.mockRejectedValue(noSession());
    const before = Date.now();
    act(() => auth.retry());
    expect(auth.state).toMatchObject({ status: "loading", phase: "waking", attempt: 1 });
    expect(auth.state.status === "loading" && auth.state.startedAt).toBeGreaterThanOrEqual(before);
    await advance(500);
    expect(shown()).toBe("anonymous");
  });

  it("doesn't give up once the server has answered, even if restoring the session is slow", async () => {
    const client = fakeClient();
    client.health.mockRejectedValueOnce(unavailable()).mockResolvedValue(undefined);
    client.refresh.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(session()), 93_000)));
    renderProvider(client);
    await advance(90_000);
    expect(shown()).toBe("loading:waking:0");
    await advance(5_000);
    expect(shown()).toBe("authenticated");
  });

  it("starts counting again when a failed refresh sends it back to waiting for the server", async () => {
    const client = fakeClient();
    client.health.mockResolvedValueOnce(undefined).mockRejectedValue(unavailable());
    client.refresh.mockImplementation(
      () => new Promise((_resolve, reject) => setTimeout(() => reject(unavailable()), 60_000)),
    );
    renderProvider(client);
    await advance(149_999);
    expect(shown()).toBe("loading:waking:0");
    await advance(1);
    expect(shown()).toBe("loading:slow:0");
  });

  it("keeps counting towards the limit when refreshes keep failing on an awake server", async () => {
    const client = fakeClient();
    client.refresh.mockRejectedValue(unavailable());
    renderProvider(client);
    await advance(10_000);
    // One refresh every two seconds, never a tight loop.
    expect(client.refresh.mock.calls.length).toBeLessThanOrEqual(6);
    await advance(80_000);
    expect(shown()).toBe("loading:slow:0");
  });

  it("ignores retry while still waking", async () => {
    const client = fakeClient();
    client.health.mockRejectedValue(unavailable());
    renderProvider(client);
    await advance(5000);
    act(() => auth.retry());
    expect(shown()).toBe("loading:waking:0");
  });

  it("says the device is offline instead of polling, and resumes when it is back", async () => {
    setOnline(false);
    const client = fakeClient();
    renderProvider(client);
    await advance(10_000);
    expect(shown()).toBe("loading:offline:0");
    expect(client.health).not.toHaveBeenCalled();

    setOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(client.health).toHaveBeenCalledOnce();
    expect(shown()).toBe("authenticated");
  });

  it("pauses when the connection drops mid-wait and starts a new attempt when it returns", async () => {
    const client = fakeClient();
    client.health.mockImplementation(
      (signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new ApiRequestError("network", 0)));
        }),
    );
    renderProvider(client);
    await advance(3000);
    const attemptSignal = client.health.mock.calls[0]?.[0];

    setOnline(false);
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(shown()).toBe("loading:offline:0");
    expect(attemptSignal?.aborted).toBe(true);

    // The 90-second limit belongs to the attempt that was cancelled.
    await advance(120_000);
    expect(shown()).toBe("loading:offline:0");

    setOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(shown()).toBe("loading:waking:1");
    await advance(89_999);
    expect(shown()).toBe("loading:waking:1");
    await advance(1);
    expect(shown()).toBe("loading:slow:1");
  });
});
