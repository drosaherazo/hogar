import type { ErrorCode } from "@hogar/shared";

/** An expected failure with an HTTP status and a code the web can translate. Never a user-facing sentence. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
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
