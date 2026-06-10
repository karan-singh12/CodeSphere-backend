import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';
import * as apiRes from '../utils/apiResponse';

export const validateBody = (schema: ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((error) => ({
        path: error.path.join('.'),
        message: error.message,
      }));
      return apiRes.validationErrorResponse(res, 'Invalid request body', errors);
    }
    req.body = result.data;
    next();
  };
};
