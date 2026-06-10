import { Request } from 'express';

export interface IAuthUser {
    id?: string | number;
    username?: string;
    nickname?: string;
    name?: string;
    email_address?: string;
    role?: string;
    isVerified?: boolean;
    status?: number;
    avatar?: string;
    is_age_verified?: boolean;
    email_verified?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    [key: string]: any;
}

export interface AuthenticatedRequest extends Request {
    user?: IAuthUser;
}

// Type guard to check if request is authenticated
export function isAuthenticated(req: Request): req is AuthenticatedRequest {
    return 'user' in req && req.user !== undefined;
}

// Type guard to check if user has specific role
export function hasRole(user: IAuthUser, role: string): boolean {
    return user.role === role;
}


// Type guard to check if user is verified
export function isVerified(user: IAuthUser): boolean {
    return user.isVerified === true;
}

// Type guard to check if user is active
export function isActive(user: IAuthUser): boolean {
    return user.status === 1;
}
