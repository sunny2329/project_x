import net from 'node:net';
import pg from 'pg';

// Neon (us-west-2) resolves to IPv6 and IPv4 addresses. Node gives each address 250 ms before
// trying the next, which is too short on slow links: every attempt failed with ETIMEDOUT.
net.setDefaultAutoSelectFamilyAttemptTimeout(2_000);

// Many project_x tables use `timestamp` (without time zone), filled by CURRENT_TIMESTAMP in the
// database's UTC session. pg parses those in the Node process's zone (IST on dev machines), which
// shifts them by 5.5 h, so read them as UTC. When filtering on such a column, pass an ISO string
// and convert in SQL: `$1::timestamptz AT TIME ZONE 'UTC'`.
const TIMESTAMP_WITHOUT_TIME_ZONE = 1114;
pg.types.setTypeParser(TIMESTAMP_WITHOUT_TIME_ZONE, (value) => new Date(`${value.replace(' ', 'T')}Z`));

export type Queryable = Pick<pg.Pool | pg.PoolClient, 'query'>;

export interface PoolOptions {
  connectionString: string;
  max?: number;
  /** Overrides search_path; used by tests to isolate each run in its own schema. */
  schema?: string;
}

export function createPool({ connectionString, max = 10, schema }: PoolOptions): pg.Pool {
  return new pg.Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ...(schema ? { options: `-c search_path=${schema}` } : {}),
  });
}

export async function withTransaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
