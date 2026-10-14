import type { RequestHandler } from 'express';
import { z, type ZodType } from 'zod';
import { AppError } from '../utils/app-error.js';

/** Replaces req.body with the parsed (trimmed, normalized) result of the schema. */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const { fieldErrors, formErrors } = z.flattenError(result.error);
      const details: Record<string, string[]> = { ...(fieldErrors as Record<string, string[]>) };
      if (formErrors.length) details._ = formErrors;
      return next(AppError.badRequest('VALIDATION_ERROR', 'Some fields are invalid.', details));
    }
    req.body = result.data;
    next();
  };
}
