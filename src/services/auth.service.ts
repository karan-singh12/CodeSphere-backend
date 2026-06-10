import prisma from '../config/prisma';
import { PasswordService } from './auth/password.service';
import { TokenService } from './auth/token.service';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/env';

export interface AuthPayload {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    imageUrl: string;
    credits: number;
    plan: string;
  };
}

export class AuthService {
  static async signUp(name: string | undefined, email: string, password: string): Promise<AuthPayload> {
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      throw new Error('Email already exists');
    }

    const passwordHash = await PasswordService.hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name: name?.trim() || 'User',
        email: normalizedEmail,
        passwordHash,
      },
    });

    const token = TokenService.generateAccessToken(user.id, JWT_SECRET, JWT_EXPIRES_IN, user.email).token;
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        credits: user.credits,
        plan: user.plan,
      },
    };
  }

  static async login(email: string, password: string): Promise<AuthPayload> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      throw new Error('Invalid login credentials');
    }

    const isValid = await PasswordService.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid login credentials');
    }

    const token = TokenService.generateAccessToken(user.id, JWT_SECRET, JWT_EXPIRES_IN, user.email).token;
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        credits: user.credits,
        plan: user.plan,
      },
    };
  }
}
