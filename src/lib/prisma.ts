import { PrismaClient } from "@prisma/client";

// Prevent multiple Prisma Client instances in development (hot reload).
// In production, the module scope is only evaluated once.
//
// DATABASE_URL is read from .env.local by Prisma at runtime.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
