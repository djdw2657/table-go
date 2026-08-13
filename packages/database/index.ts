import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./generated/client";
import { keys } from "./keys";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// DATABASE_URL is expected to be Supabase's Supavisor transaction-mode
// pooler (port 6543, `?pgbouncer=true`) — right-sized for serverless
// functions, which open many short-lived connections. See CLAUDE.md for
// why this isn't the direct/session connection (that's for `prisma db
// push`/`generate` only, via packages/database/.env, not app runtime).
const pool = new Pool({ connectionString: keys().DATABASE_URL });
const adapter = new PrismaPg(pool);

export const database = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = database;
}

export * from "./generated/client";
