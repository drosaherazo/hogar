import type { Server as HttpServer } from "node:http";
import {
  API_VERSION,
  SOCKET_PATH,
  socketAuthSchema,
  type ClientToServerEvents,
  type ErrorCode,
  type ServerToClientEvents,
} from "@hogar/shared";
import { Server, type Socket } from "socket.io";
import { createOriginMatcher } from "../auth/originMatcher";
import { createAccessTokenSigner } from "../auth/tokens";
import type { Config } from "../config";
import type { Database } from "../db";
import type { HouseholdEvents } from "./householdEvents";

interface SocketData {
  userId: string;
  householdId: string;
}

type Handshake = Socket["handshake"];

export interface RealtimeDeps {
  config: Config;
  db: Database;
}

const householdRoom = (householdId: string) => `household:${householdId}`;
const userRoom = (userId: string) => `user:${userId}`;

/**
 * Hogar's Socket.io server: one room per household, joined only by the server from the caller's
 * own membership, plus one room per person so a membership that ends can reach all their screens.
 */
export function createRealtime({ config, db }: RealtimeDeps) {
  const signer = createAccessTokenSigner(config.jwtAccessSecret, config.accessTokenTtlSeconds);
  const isAllowedOrigin = createOriginMatcher(config.webOrigin, config.webPreviewOrigin);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>({
    path: SOCKET_PATH,
    transports: ["websocket"],
    serveClient: false,
  });

  /**
   * Who is connecting, or the code to refuse them with, checked in the order the HTTP API checks:
   * an outdated web first, so it always gets the required update screen. The origin check is the
   * one `/api/auth` uses; browsers always send `Origin` on a WebSocket handshake, which is why the
   * socket only speaks WebSocket and never falls back to polling.
   */
  async function admit({ auth: raw, headers }: Handshake): Promise<SocketData | ErrorCode> {
    const version = socketAuthSchema.shape.apiVersion.safeParse(raw["apiVersion"]);
    if (!version.success || version.data < API_VERSION) return "client.outdated";
    if (!isAllowedOrigin(headers.origin)) return "request.forbidden_origin";

    const auth = socketAuthSchema.safeParse(raw);
    const claims = auth.success ? await signer.verify(auth.data.token) : null;
    if (!claims) return "auth.token.invalid";
    const membership = await db.membership.findUnique({ where: { userId: claims.sub } });
    if (!membership) return "household.not_member";
    return { userId: membership.userId, householdId: membership.householdId };
  }

  // A refusal reaches the web as `connect_error`, with the code as its message.
  io.use((socket, next) => {
    admit(socket.handshake).then(
      (admitted) => {
        if (typeof admitted === "string") return next(new Error(admitted));
        socket.data = admitted;
        next();
      },
      () => next(new Error("server.unexpected" satisfies ErrorCode)),
    );
  });

  /** Takes `userId`'s sockets out of the household's room and tells their screens to re-read. */
  function leaveHousehold(sockets: { socketsLeave(room: string): void }, householdId: string, userId: string) {
    sockets.socketsLeave(householdRoom(householdId));
    // They re-read and find no household: the removal notice shows, and the web disconnects.
    io.to(userRoom(userId)).emit("household:changed");
  }

  io.on("connection", (socket) => {
    const { userId, householdId } = socket.data;
    void socket.join([householdRoom(householdId), userRoom(userId)]);
    // A membership that ended while this socket was being let in couldn't take it out of a room it
    // wasn't in yet, so look again now that it is in.
    db.membership
      .findUnique({ where: { userId }, select: { householdId: true } })
      .then((current) => {
        if (current?.householdId !== householdId) leaveHousehold(io.in(socket.id), householdId, userId);
      })
      .catch(() => socket.disconnect());
  });

  const events: HouseholdEvents = {
    publish(householdId, event) {
      io.to(householdRoom(householdId)).emit(event);
    },
    membershipEnded(householdId, userId) {
      leaveHousehold(io.in(userRoom(userId)), householdId, userId);
    },
  };

  return {
    events,
    attach: (server: HttpServer) => io.attach(server),
    close: () => io.close(),
  };
}
