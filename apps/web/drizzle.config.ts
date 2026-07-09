import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://foodtruck:foodtruck@localhost:5432/foodtruck',
  },
  strict: true,
  verbose: true,
});
