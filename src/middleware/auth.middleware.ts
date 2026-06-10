import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { JWT_SECRET } from "../config/env";
import * as apiRes from "../utils/apiResponse";

interface DecodedToken {
  userId: string;
  email?: string;
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return apiRes.unauthorizedResponse(res, "Unauthorized");
  }

  const token = authHeader.replace("Bearer ", "").trim();

  try {
    const payload = jwt.verify(token, JWT_SECRET) as DecodedToken;

    if (!payload || !payload.userId) {
      return apiRes.unauthorizedResponse(res, "Unauthorized");
    }

    (req as any).user = {
      userId: payload.userId,
      id: payload.userId,
      email: payload.email,
    };
    
    next();
  } catch (error) {
    return apiRes.unauthorizedResponse(res, "Unauthorized");
  }
};

export default authMiddleware;
