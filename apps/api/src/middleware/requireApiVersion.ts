import { API_VERSION, API_VERSION_HEADER } from "@hogar/shared";
import type { RequestHandler } from "express";
import { HttpError } from "../httpError";

/**
 * Answers `426 client.outdated` when a request's `X-Hogar-Api-Version` is missing or lower than
 * `API_VERSION`, so a web too old for this API shows the required update screen instead of failing
 * in confusing ways. Mounted before every router except `/api/health`.
 *
 * Why this shape:
 * - One number, raised by hand in the PR that breaks the contract. Per-build versions (a commit
 *   hash) would send every open tab to the required update on every deploy, losing unsaved work
 *   even when nothing broke; ordinary deploys get the quiet update notice instead.
 * - Checked on every request, not as a minimum in the health check: the health check only runs
 *   while the app starts (ADR 0006), but tabs and installed apps stay open for days, and the next
 *   request after a deploy is what has to fail cleanly. The health check stays version-free so
 *   waking the server never depends on it.
 * - Vercel (web) and Render (API) deploy the same merge independently, minutes apart. A newer
 *   version than ours isn't blocked, so a web that lands first is never sent to the required update
 *   (calls that need the new API may still fail until Render finishes). If the API lands first,
 *   older webs see the required update, and reloading brings the old web back (and the screen)
 *   until Vercel finishes.
 */
export const requireApiVersion: RequestHandler = (req, _res, next) => {
  const sent = req.get(API_VERSION_HEADER);
  const version = sent !== undefined && /^\d+$/.test(sent) ? Number(sent) : 0;
  if (version < API_VERSION) throw new HttpError(426, "client.outdated");
  next();
};
