import rateLimit from "express-rate-limit";
import * as apiRes from "../utils/apiResponse";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 login/signup requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return apiRes.errorResponse(
      res,
      "Too many login or signup attempts. Please try again after 15 minutes.",
      429
    );
  },
});

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 AI requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return apiRes.errorResponse(
      res,
      "Too many AI generation requests from this IP. Please try again after an hour.",
      429
    );
  },
});
