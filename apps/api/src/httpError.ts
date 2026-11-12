import type { ErrorCode } from "@hogar/shared";

/** An expected failure with an HTTP status and a code the web can translate. Never a user-facing sentence. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    /** Extra response headers, such as `Retry-After`. */
    readonly headers: Readonly<Record<string, string>> = {},
  ) {
    super(code);
    this.name = "HttpError";
  }
}

export const badRequest = (code: ErrorCode = "request.invalid") => new HttpError(400, code);
export const unauthorized = (code: ErrorCode) => new HttpError(401, code);
export const forbidden = (code: ErrorCode) => new HttpError(403, code);
export const notFound = (code: ErrorCode) => new HttpError(404, code);
export const conflict = (code: ErrorCode) => new HttpError(409, code);
/** The resource existed but can't be used any more (an expired, used or revoked invitation). */
export const gone = (code: ErrorCode) => new HttpError(410, code);
/** Asked too often; `retryAfterSeconds`, when known, tells the client when to try again. */
export const tooManyRequests = (code: ErrorCode, retryAfterSeconds?: number) =>
  new HttpError(429, code, retryAfterSeconds === undefined ? {} : { "Retry-After": String(retryAfterSeconds) });
/** A service we depend on (the email provider) failed; trying again later may work. */
export const serviceUnavailable = (code: ErrorCode) => new HttpError(503, code);
