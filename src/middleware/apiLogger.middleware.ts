import { Request, Response, NextFunction } from "express";
import { log } from "../utils/logger";

export const apiLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const { method, originalUrl } = req;
    const startTime = Date.now();

    res.on("finish", () => {
        const duration = Date.now() - startTime;
        log(`${method} ${originalUrl} - Status: ${res.statusCode} - ${duration}ms`);
    });

    next();
};
