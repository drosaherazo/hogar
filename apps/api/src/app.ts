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
import { createMeRouter } from "./me/meRouter";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requireSameOrigin } from "./middleware/requireSameOrigin";

export interface AppDeps {
  config: Config;
  db: Database;
  google: GoogleVerifier;
  /** Requests allowed per IP on /api/auth every 15 minutes. */
  authRateLimit?: number;
  now?: (() => Date) | undefined;
}

export function createApp({ config, db, google, authRateLimit = 100, now }: AppDeps) {
  const signer = createAccessTokenSigner(config.jwtAccessSecret, config.accessTokenTtlSeconds);
  const auth = createAuthService({ db, google, signer, refreshTokenTtlDays: config.refreshTokenTtlDays, now });

  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: authRateLimit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      const body: ApiError = { error: { code: "request.rate_limited" } };
      res.status(429).json(body);
    },
  });
  app.use(
    "/api/auth",
    authLimiter,
    requireSameOrigin(config.webOrigin),
    createAuthRouter(auth, { cookieSecure: config.cookieSecure }),
  );
  app.use("/api/me", requireAuth(signer), createMeRouter(auth));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
