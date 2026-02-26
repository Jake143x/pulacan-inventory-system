import { PrismaClient } from '@prisma/client';
/**
 * Single shared PrismaClient instance for the entire app.
 * Using multiple PrismaClient instances (e.g. one per route) creates multiple
 * connection pools and can exceed database connection limits (e.g. Neon
 * "MaxClientsInSessionMode: max clients reached").
 * If you still hit limits, add ?connection_limit=5 to DATABASE_URL, or use
 * your provider's pooled URL (e.g. Neon pooler).
 */
export declare const prisma: PrismaClient<import(".prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
