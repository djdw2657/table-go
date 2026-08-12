import "server-only";

import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "./generated/client";
import { keys } from "./keys";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Query over HTTPS instead of opening a WebSocket connection. WebSocket
// upgrades are unreliable in some serverless sandboxes (observed as
// "Unexpected server response: 101" on Vercel); fetch-based queries avoid
// that entirely and work the same in local dev.
neonConfig.poolQueryViaFetch = true;

const adapter = new PrismaNeon({ connectionString: keys().DATABASE_URL });

export const database = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = database;
}

export * from "./generated/client";
