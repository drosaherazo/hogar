import { errorCodeFrom, versionQuerySchema } from "@hogar/shared";
import type { Request } from "express";
import type { z } from "zod";
import { badRequest } from "./httpError";

/** Validates a body with a shared schema; the first failed check becomes the error code. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest(errorCodeFrom(parsed.error));
  return parsed.data;
}

/** The version a delete was based on, from `?version=`; required, so stale deletes can be refused. */
export function versionOf(req: Request): number {
  const query = versionQuerySchema.safeParse(req.query);
  if (!query.success) throw badRequest("request.invalid");
  return query.data.version;
}
