import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ quiet: true });

// Migrations and introspection use the direct (non-pooled) Neon URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL_DIRECT'),
  },
});
