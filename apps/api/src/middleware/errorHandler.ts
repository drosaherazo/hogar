import type { ApiError } from "@hogar/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "../httpError";

function send(res: Parameters<RequestHandler>[1], status: number, code: ApiError["error"]["code"]) {
  const body: ApiError = { error: { code } };
  res.status(status).json(body);
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  send(res, 404, "request.invalid");
};

/** Turns every error into `{ error: { code } }`. Unexpected errors are logged and never leak details. */
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof HttpError) {
    send(res, error.status, error.code);
    return;
  }
  // Malformed JSON bodies reach us as a 400 from express.json().
  if (error instanceof SyntaxError && "status" in error && error.status === 400) {
    send(res, 400, "request.invalid");
    return;
  }
  console.error(error);
  send(res, 500, "server.unexpected");
};
