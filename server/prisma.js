import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// The DATABASE_URL may be missing in development environments where the API
// routes are not used (the application falls back to IndexedDB). Prisma is
// therefore initialized lazily: importing this module never throws. A clear
// error is raised the first time a database call is actually attempted.
let client;
const globalForPrisma = globalThis;

function buildPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.trim().startsWith('<')) {
    const error = new Error('DATABASE_URL environment variable is required.');
    error.code = 'REQUIRED_CONFIG_MISSING';
    throw error;
  }

  const normalizedConnectionString = connectionString.replace(
    /sslmode=(prefer|require|verify-ca)/g,
    'sslmode=verify-full'
  );

  return new Pool({
    connectionString: normalizedConnectionString,
    ssl: connectionString.includes('sslmode=disable')
      ? false
      : { rejectUnauthorized: false },
  });
}

function createPrisma() {
  const pool = buildPool();
  const adapter = new PrismaPg(pool);
  const prismaClient = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__groupeGaffPrisma = prismaClient;
  }
  return prismaClient;
}

function getPrisma() {
  if (client) return client;
  client = globalForPrisma.__groupeGaffPrisma ?? createPrisma();
  return client;
}

// Property access on the proxy initializes Prisma on first real usage,
// keeping existing `prisma.user.findMany(...)` call sites unchanged.
export const prisma = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'then') return undefined;
    return getPrisma()[prop];
  },
});