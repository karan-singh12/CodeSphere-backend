import { z } from 'zod';

export const signUpSchema = z.object({
  name: z.string().optional(),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must contain at least 6 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const chatSchema = z.object({
  conversationId: z.string().optional(),
  prompt: z.string().min(1, 'Prompt is required'),
});

export const logSchema = z.object({
  conversationId: z.string(),
  provider: z.string().min(1),
  model: z.string().min(1),
  latency: z.number().int().nonnegative(),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  status: z.enum(['success', 'error']),
  inputPreview: z.string().optional(),
  outputPreview: z.string().optional(),
  errorMessage: z.string().optional(),
});
