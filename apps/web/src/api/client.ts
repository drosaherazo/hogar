import {
  apiErrorSchema,
  authResponseSchema,
  authUserSchema,
  type AuthResponse,
  type AuthUser,
  type ErrorCode,
} from "@hogar/shared";
import type { z } from "zod";

/** A failed request, with a code the UI can translate (`errors:<code>`). */
export class ApiRequestError extends Error {
  constructor(
    readonly code: ErrorCode | "network",
    readonly status: number,
  ) {
    super(code);
    this.name = "ApiRequestError";
  }
}

interface RequestOptions<T> {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  schema?: z.ZodType<T>;
  /** Send the access token and, on 401, refresh it once and retry. */
  authenticated?: boolean;
}

/**
 * Talks to the Hogar API.
 * The access token lives only in memory; the refresh token is an httpOnly cookie the browser
 * sends to /api/auth on its own. Concurrent refreshes share a single request, because the API
 * rotates the refresh token on every use.
 */
export class ApiClient {
  private accessToken: string | null = null;
  private refreshing: Promise<AuthResponse> | null = null;

  private readonly sessionExpiredListeners = new Set<() => void>();

  constructor(
    private readonly baseUrl = "/api",
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  /** Runs `listener` when the session can't be recovered, so the app can return to the login page. */
  onSessionExpired(listener: () => void): () => void {
    this.sessionExpiredListeners.add(listener);
    return () => this.sessionExpiredListeners.delete(listener);
  }

  get hasAccessToken() {
    return this.accessToken !== null;
  }

  async loginWithGoogle(credential: string): Promise<AuthResponse> {
    const session = await this.request("/auth/google", {
      method: "POST",
      body: { credential },
      schema: authResponseSchema,
      authenticated: false,
    });
    this.accessToken = session.accessToken;
    return session;
  }

  /** Restores or extends the session with the refresh cookie. */
  refresh(): Promise<AuthResponse> {
    this.refreshing ??= this.request("/auth/refresh", {
      method: "POST",
      schema: authResponseSchema,
      authenticated: false,
    })
      .then((session) => {
        this.accessToken = session.accessToken;
        return session;
      })
      .catch((error: unknown) => {
        this.accessToken = null;
        throw error;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  async logout(): Promise<void> {
    try {
      await this.request("/auth/logout", { method: "POST", authenticated: false });
    } finally {
      this.accessToken = null;
    }
  }

  me(): Promise<AuthUser> {
    return this.request("/me", { schema: authUserSchema });
  }

  async request<T = void>(path: string, options: RequestOptions<T> = {}, isRetry = false): Promise<T> {
    const { method = "GET", body, schema, authenticated = true } = options;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (authenticated && this.accessToken) headers["Authorization"] = `Bearer ${this.accessToken}`;

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        credentials: "same-origin",
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiRequestError("network", 0);
    }

    if (response.status === 401 && authenticated && !isRetry) {
      try {
        await this.refresh();
      } catch (error) {
        this.sessionExpiredListeners.forEach((listener) => listener());
        throw error;
      }
      return this.request(path, options, true);
    }

    if (!response.ok) throw await toError(response);
    if (!schema || response.status === 204) return undefined as T;
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) throw new ApiRequestError("server.unexpected", response.status);
    return parsed.data;
  }
}

async function toError(response: Response): Promise<ApiRequestError> {
  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    if (parsed.success) return new ApiRequestError(parsed.data.error.code, response.status);
  } catch {
    // Not JSON (a proxy error page, for example).
  }
  return new ApiRequestError(response.status >= 500 ? "server.unexpected" : "request.invalid", response.status);
}

/** Translation key for any error thrown by the client. */
export function errorKey(error: unknown) {
  const code = error instanceof ApiRequestError ? error.code : "server.unexpected";
  return `errors:${code}` as const;
}
