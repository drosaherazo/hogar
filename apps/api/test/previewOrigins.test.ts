import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp, WEB_ORIGIN } from "./testApp";

// ADR 0010: on `dev`, the API also accepts the origins of the project's Vercel previews.
const PREVIEW_PATTERN = "https://hogar-*-drosaherazos-projects.vercel.app";

function signInFrom(origin: string | undefined, { withPreviewPattern = true } = {}) {
  const { app } = createTestApp(withPreviewPattern ? { webPreviewOrigin: PREVIEW_PATTERN } : {});
  const req = request(app).post("/api/auth/google");
  if (origin) req.set("Origin", origin);
  return req.send({ credential: "valid-ana-token" });
}

describe("auth origin check with a preview pattern", () => {
  it.each([
    "https://hogar-git-feat-shopping-list-drosaherazos-projects.vercel.app",
    "https://hogar-abc123xyz-drosaherazos-projects.vercel.app",
  ])("accepts the preview origin %s", async (origin) => {
    const res = await signInFrom(origin);
    expect(res.status).toBe(200);
  });

  it("still accepts the web app's own origin", async () => {
    const res = await signInFrom(WEB_ORIGIN);
    expect(res.status).toBe(200);
  });

  it.each([
    ["another domain smuggled through the wildcard", "https://hogar-x.evil.com/-drosaherazos-projects.vercel.app"],
    ["a dot inside the wildcard", "https://hogar-x.evil-drosaherazos-projects.vercel.app"],
    ["a scope that only resembles the project's", "https://hogar-x-drosaherazos-projects-evil.vercel.app"],
    ["another scope ending in the project's name", "https://hogar-x-notdrosaherazos-projects.vercel.app.evil.com"],
    ["an empty wildcard", "https://hogar--drosaherazos-projects.vercel.app"],
    ["plain http", "http://hogar-abc123-drosaherazos-projects.vercel.app"],
    ["a port", "https://hogar-abc123-drosaherazos-projects.vercel.app:8443"],
    ["no Origin header", undefined],
  ])("rejects %s", async (_case, origin) => {
    const res = await signInFrom(origin);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "request.forbidden_origin" } });
  });
});

describe("auth origin check without a preview pattern", () => {
  it("rejects preview origins, so production keeps a single exact origin", async () => {
    const res = await signInFrom("https://hogar-abc123-drosaherazos-projects.vercel.app", {
      withPreviewPattern: false,
    });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "request.forbidden_origin" } });
  });
});
