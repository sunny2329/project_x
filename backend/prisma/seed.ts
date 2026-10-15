import { createPool } from '../src/database/pool.js';
import { createPrisma } from '../src/database/prisma.js';
import { seedAll } from '../src/database/seed.js';
import { loadEnv } from '../src/config/env.js';

const env = loadEnv();
const pool = createPool({ connectionString: env.DATABASE_URL_DIRECT ?? env.DATABASE_URL, max: 2 });
const db = createPrisma(pool);
try {
  const counts = await seedAll(db);
  for (const [what, n] of Object.entries(counts)) console.log(`${what}: ${n}`);
} finally {
  await db.$disconnect();
  await pool.end();
}
