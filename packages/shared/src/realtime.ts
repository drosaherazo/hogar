import { z } from "zod";

/**
 * Where the API serves Socket.io: under `/api`, so Vercel's `/api/*` rewrite and Vite's dev proxy
 * reach it like any other request and the browser keeps a single origin.
 */
export const SOCKET_PATH = "/api/socket.io";

/**
 * What the server tells the members of a household while they have Hogar on screen. Events are
 * signals, not data: clients re-read what changed through the REST API, which stays the only
 * source of truth (and of permission checks).
 */
export interface ServerToClientEvents {
  /** The household's name, currency, split, members or roles changed. */
  "household:changed": () => void;
  /** Something on the shopping list or in a cart changed. */
  "shopping:changed": () => void;
}

export type HouseholdEvent = keyof ServerToClientEvents;

/** The web only listens: it never sends events. */
export type ClientToServerEvents = Record<string, never>;

/**
 * What the web sends when it connects: the access token (ADR 0002), and its `API_VERSION` so an
 * outdated web gets `client.outdated` and the required update screen instead of a silent socket.
 */
export const socketAuthSchema = z.object({
  token: z.string().min(1),
  apiVersion: z.number().int().nonnegative(),
});
export type SocketAuth = z.infer<typeof socketAuthSchema>;
