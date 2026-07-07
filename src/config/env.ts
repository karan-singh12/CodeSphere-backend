import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

export const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
export const DATABASE_URL = process.env.DATABASE_URL ?? '';
export const DATABASE_CONNECT_TIMEOUT_MS = process.env.DATABASE_CONNECT_TIMEOUT_MS
  ? Number(process.env.DATABASE_CONNECT_TIMEOUT_MS)
  : 10000;
export const DATABASE_LOG_LEVEL = process.env.DATABASE_LOG_LEVEL ?? 'query,info,warn,error';
export const JWT_SECRET = process.env.JWT_SECRET ?? 'default-local-secret';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1d';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
export const GEMINI_API_BASE_URL = process.env.GEMINI_API_BASE_URL ?? 'https://generativelanguage.googleapis.com';
export const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';
export const GROQ_API_BASE_URL = process.env.GROQ_API_BASE_URL ?? 'https://api.groq.com';
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? '';
export const NODE_ENV = process.env.NODE_ENV ?? 'development';
