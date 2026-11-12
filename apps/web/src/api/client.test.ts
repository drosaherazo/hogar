import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { ana, apiError, categoryView, server, session, starterCategories } from "../test/server";
import { ApiClient, ApiRequestError, errorKey } from "./client";

const BASE = "http://localhost/api";

describe("ApiClient", () => {
  it("logs in with Google and keeps the access token in memory", async () => {
    let sentBody: unknown;
    server.use(
      http.post(`${BASE}/auth/google`, async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json(session());
      }),
    );
    const client = new ApiClient(BASE);
    expect(await client.loginWithGoogle("google-token")).toEqual(session());
    expect(sentBody).toEqual({ credential: "google-token" });
    expect(client.hasAccessToken).toBe(true);
  });

  it("sends the access token as a Bearer header", async () => {
    let authorization: string | null = null;
    server.use(
      http.post(`${BASE}/auth/google`, () => HttpResponse.json(session(ana, "token-123"))),
      http.get(`${BASE}/me`, ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json(ana);
      }),
    );
    const client = new ApiClient(BASE);
    await client.loginWithGoogle("google-token");
    await client.me();
    expect(authorization).toBe("Bearer token-123");
  });

  it("shares one refresh request between concurrent callers (the API rotates the token)", async () => {
    const refresh = vi.fn(() => HttpResponse.json(session()));
    server.use(http.post(`${BASE}/auth/refresh`, refresh));
    const client = new ApiClient(BASE);
    await Promise.all([client.refresh(), client.refresh(), client.refresh()]);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("refreshes once and retries when the access token has expired", async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/auth/refresh`, () => HttpResponse.json(session(ana, "fresh-token"))),
      http.get(`${BASE}/me`, ({ request }) => {
        calls += 1;
        return request.headers.get("authorization") === "Bearer fresh-token"
          ? HttpResponse.json(ana)
          : apiError(401, "auth.token.invalid");
      }),
    );
    const client = new ApiClient(BASE);
    expect(await client.me()).toEqual(ana);
    expect(calls).toBe(2);
  });

  it("reports an expired session when the refresh also fails", async () => {
    server.use(
      http.post(`${BASE}/auth/refresh`, () => apiError(401, "auth.session.expired")),
      http.get(`${BASE}/me`, () => apiError(401, "auth.token.invalid")),
    );
    const client = new ApiClient(BASE);
    const onSessionExpired = vi.fn();
    client.onSessionExpired(onSessionExpired);
    await expect(client.me()).rejects.toMatchObject({ code: "auth.session.expired", status: 401 });
    expect(onSessionExpired).toHaveBeenCalledOnce();
    expect(client.hasAccessToken).toBe(false);
  });

  it("turns API errors into codes", async () => {
    server.use(http.post(`${BASE}/auth/google`, () => apiError(401, "auth.google.email_not_verified")));
    const error = await new ApiClient(BASE).loginWithGoogle("x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(errorKey(error)).toBe("errors:auth.google.email_not_verified");
  });

  it("maps unexpected responses and network failures to generic codes", async () => {
    server.use(http.post(`${BASE}/auth/google`, () => new HttpResponse("<html>Bad gateway</html>", { status: 502 })));
    await expect(new ApiClient(BASE).loginWithGoogle("x")).rejects.toMatchObject({ code: "server.unexpected" });

    const offline = new ApiClient(BASE, () => Promise.reject(new TypeError("Failed to fetch")));
    await expect(offline.loginWithGoogle("x")).rejects.toMatchObject({ code: "network", status: 0 });
  });

  it("rejects responses that don't match the expected shape", async () => {
    server.use(http.post(`${BASE}/auth/google`, () => HttpResponse.json({ accessToken: "x" })));
    await expect(new ApiClient(BASE).loginWithGoogle("x")).rejects.toMatchObject({ code: "server.unexpected" });
  });

  it("forgets the access token on logout even if the request fails", async () => {
    server.use(
      http.post(`${BASE}/auth/google`, () => HttpResponse.json(session())),
      http.post(`${BASE}/auth/logout`, () => HttpResponse.error()),
    );
    const client = new ApiClient(BASE);
    await client.loginWithGoogle("x");
    await expect(client.logout()).rejects.toBeInstanceOf(ApiRequestError);
    expect(client.hasAccessToken).toBe(false);
  });
});

describe("ApiClient categories", () => {
  it("reads, creates, renames, splits and deletes categories", async () => {
    const calls: { method: string; path: string; body: unknown }[] = [];
    const record = async ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      calls.push({
        method: request.method,
        path: `${url.pathname}${url.search}`,
        body: request.method === "GET" || request.method === "DELETE" ? null : await request.json(),
      });
    };
    const dog = categoryView({ id: "cat_dog", name: "Dog", emoji: "🐶", position: 6 });
    server.use(
      http.get(`${BASE}/household/categories`, async (info) => {
        await record(info);
        return HttpResponse.json({ categories: starterCategories() });
      }),
      http.post(`${BASE}/household/categories`, async (info) => {
        await record(info);
        return HttpResponse.json({ category: dog }, { status: 201 });
      }),
      http.patch(`${BASE}/household/categories/:id`, async (info) => {
        await record(info);
        return HttpResponse.json({ category: { ...dog, name: "Perro", version: 2 } });
      }),
      http.put(`${BASE}/household/categories/:id/split`, async (info) => {
        await record(info);
        return HttpResponse.json({ category: { ...dog, version: 3 } });
      }),
      http.delete(`${BASE}/household/categories/:id`, async (info) => {
        await record(info);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const client = new ApiClient(BASE);

    expect(await client.getCategories()).toHaveLength(5);
    expect(await client.createCategory({ name: "Dog", emoji: "🐶" })).toEqual(dog);
    expect((await client.updateCategory("cat_dog", { name: "Perro", emoji: "🐶", version: 1 })).name).toBe("Perro");
    await client.updateCategorySplit("cat_dog", { version: 2, ownSplit: false });
    await client.deleteCategory("cat_dog", 3);

    expect(calls).toEqual([
      { method: "GET", path: "/api/household/categories", body: null },
      { method: "POST", path: "/api/household/categories", body: { name: "Dog", emoji: "🐶" } },
      { method: "PATCH", path: "/api/household/categories/cat_dog", body: { name: "Perro", emoji: "🐶", version: 1 } },
      { method: "PUT", path: "/api/household/categories/cat_dog/split", body: { version: 2, ownSplit: false } },
      { method: "DELETE", path: "/api/household/categories/cat_dog?version=3", body: null },
    ]);
  });

  it("filters the history by category, keeping the cursor", async () => {
    const searches: string[] = [];
    server.use(
      http.get(`${BASE}/household/activity`, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json({ items: [], nextCursor: null });
      }),
    );
    const client = new ApiClient(BASE);
    await client.getActivity();
    await client.getActivity(undefined, "none");
    await client.getActivity("abc", "cat_rent");
    expect(searches).toEqual(["", "?category=none", "?cursor=abc&category=cat_rent"]);
  });
});
