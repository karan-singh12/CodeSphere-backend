import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId?: any;
        id?: any;
        email?: string;
        _id?: string;
        role?: string;
        [key: string]: any;
      };
    }
  }
}
