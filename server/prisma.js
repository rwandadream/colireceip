import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required.');
}

const normalizedConnectionString = connectionString.replace(
  /sslmode=(prefer|require|verify-ca)/g,
  'sslmode=verify-full'
);

const pool = new Pool({
  connectionString: normalizedConnectionString,
  ssl: connectionString.includes('sslmode=disable')
    ? false
    : { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__groupeGaffPrisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__groupeGaffPrisma = prisma;
}
