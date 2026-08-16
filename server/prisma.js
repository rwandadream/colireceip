import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Database configuration is unavailable.');
}

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__groupeGaffPrisma ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__groupeGaffPrisma = prisma;
}
