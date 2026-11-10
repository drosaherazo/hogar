import type { ApiError } from "@hogar/shared";
import cookieParser from "cookie-parser";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { createAuthRouter } from "./auth/authRouter";
import { createAuthService } from "./auth/authService";
import type { GoogleVerifier } from "./auth/googleVerifier";
import { requireAuth } from "./auth/requireAuth";
import { createAccessTokenSigner } from "./auth/tokens";
import type { Config } from "./config";
import type { Database } from "./db";
import { createHouseholdRouter } from "./household/householdRouter";
import { createHouseholdService } from "./household/householdService";
import { createHouseholdInvitationsRouter, createInvitationsRouter } from "./household/invitationRouter";
import { createInvitationService } from "./household/invitationService";
import { createMeRouter } from "./me/meRouter";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requireSameOrigin } from "./middleware/requireSameOrigin";

export interface AppDeps {
  config: Config;
  db: Database;
  google: GoogleVerifier;
  /** Requests allowed per IP on /api/auth every 15 minutes. */
  authRateLimit?: number;
  /** Requests allowed per IP on /api/invitations (lookup and accept) every 15 minutes. */
  invitationRateLimit?: number;
  now?: (() => Date) | undefined;
}

/** Limits requests per IP over 15 minutes, answering with the usual error shape. */
function limitPerIp(limit: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      const body: ApiError = { error: { code: "request.rate_limited" } };
      res.status(429).json(body);
    },
  });
}

export function createApp({ config, db, google, authRateLimit = 100, invitationRateLimit = 30, now }: AppDeps) {
  const signer = createAccessTokenSigner(config.jwtAccessSecret, config.accessTokenTtlSeconds);
  const auth = createAuthService({ db, google, signer, refreshTokenTtlDays: config.refreshTokenTtlDays, now });

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxyHops);
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(
    "/api/auth",
    limitPerIp(authRateLimit),
    requireSameOrigin(config.webOrigin),
    createAuthRouter(auth, { cookieSecure: config.cookieSecure }),
  );

  const households = createHouseholdService({ db, now });
  app.use("/api/me", requireAuth(signer), createMeRouter(auth, households));
  const invitations = createInvitationService({ db, households, now });
  app.use("/api/household/invitations", requireAuth(signer), createHouseholdInvitationsRouter(db, invitations));
  app.use("/api/household", requireAuth(signer), createHouseholdRouter(db, households));
  app.use(
    "/api/invitations",
    requireAuth(signer),
    createInvitationsRouter(invitations, limitPerIp(invitationRateLimit)),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
