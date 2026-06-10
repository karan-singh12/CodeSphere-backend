import { Request, Response } from 'express';
import * as apiRes from '../utils/apiResponse';
import prisma from '../config/prisma';

export const ingestLog = async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    await prisma.inferenceLog.create({ data: payload });
    return apiRes.successResponse(res, 'Log ingested');
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Could not ingest log', 400);
  }
};
