import { PrismaClient, Prisma } from '@prisma/client';
import { config } from './index';

const connectionTimeoutSeconds = Math.max(1, Math.ceil((process.env.DATABASE_CONNECT_TIMEOUT_MS ? Number(process.env.DATABASE_CONNECT_TIMEOUT_MS) : 10000) / 1000));

function getDatabaseUrl(): string {
  const url = config.db.url || process.env.DATABASE_URL || process.env.DB_URL;

  if (!url) {
    console.error('❌ Database URL is not configured. Set DB_URL or DATABASE_URL in backendllm/.env');
    process.exit(1);
  }

  return url;
}

function buildDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    params.set('connect_timeout', connectionTimeoutSeconds.toString());

    if (!params.has('sslmode')) {
      params.set('sslmode', 'require');
    }

    parsed.search = params.toString();
    return parsed.toString();
  } catch (error) {
    console.error(' Invalid database URL:', error);
    process.exit(1);
  }
}

const databaseUrl = buildDatabaseUrl(getDatabaseUrl());

const logLevels = (process.env.DATABASE_LOG_LEVEL || 'query,info,warn,error')
  .split(',')
  .map((level) => level.trim())
  .filter((level): level is Prisma.LogLevel => !!level);

const prisma = new PrismaClient({
  log: logLevels,
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

export default prisma;
