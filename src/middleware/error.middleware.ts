import { NextFunction, Request, Response } from 'express';
import * as apiRes from '../utils/apiResponse';

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  return apiRes.internalServerErrorResponse(res, message);
};
