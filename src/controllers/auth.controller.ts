import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import * as apiRes from '../utils/apiResponse';
import prisma from '../config/prisma';

export const signUp = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
    const result = await AuthService.signUp(name, email, password);
    return apiRes.successResponse(res, 'Signup successful', result);
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Signup failed', 400);
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    return apiRes.successResponse(res, 'Login successful', result);
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Login failed', 400);
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;
    const userId = authUser?.userId;
    if (!userId) return apiRes.unauthorizedResponse(res, 'Unauthorized');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
        credits: true,
        plan: true,
      }
    });

    if (!user) return apiRes.notFoundResponse(res, 'User not found');

    return apiRes.successResponse(res, 'Profile retrieved', user);
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Failed to retrieve profile', 400);
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;
    const userId = authUser?.userId;
    if (!userId) return apiRes.unauthorizedResponse(res, 'Unauthorized');

    const { name, email } = req.body;

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          NOT: { id: userId }
        }
      });
      if (existingUser) {
        return apiRes.errorResponse(res, 'Email already in use', 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        email: email !== undefined ? email.toLowerCase().trim() : undefined,
      },
      select: { id: true, name: true, email: true }
    });

    return apiRes.successResponse(res, 'Profile updated successfully', updatedUser);
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Failed to update profile', 400);
  }
};

export const upgradePlan = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user as { userId: string } | undefined;
    const userId = authUser?.userId;
    if (!userId) return apiRes.unauthorizedResponse(res, 'Unauthorized');

    const { plan } = req.body;
    if (!['starter', 'pro'].includes(plan)) {
      return apiRes.errorResponse(res, 'Invalid plan choice', 400);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        plan,
        credits: plan === 'pro' ? 100 : 30, // Pro gets 100 credits, Starter gets 30
      },
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
        credits: true,
        plan: true,
      }
    });

    return apiRes.successResponse(res, `Upgraded to ${plan} successfully`, updatedUser);
  } catch (error: unknown) {
    return apiRes.errorResponse(res, error instanceof Error ? error.message : 'Upgrade failed', 400);
  }
};

