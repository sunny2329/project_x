import { PrismaPg } from '@prisma/adapter-pg';
import type pg from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';

export type Db = PrismaClient;
/** A Prisma client or an interactive-transaction client. */
export type DbTx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;

/**
 * Prisma Client on top of the app's existing `pg` pool, so raw-SQL modules (auth, feed, chat)
 * and Prisma modules share connections. `schema` isolates tests in a throwaway schema.
 */
export function createPrisma(pool: pg.Pool, schema?: string): PrismaClient {
  const adapter = new PrismaPg(pool, schema ? { schema } : undefined);
  return new PrismaClient({ adapter });
}

export { Prisma } from '../generated/prisma/client.js';
