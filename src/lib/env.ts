import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("data/app.db"),
  TELEGRAM_API_ID: z.string().optional().default(""),
  TELEGRAM_API_HASH: z.string().optional().default(""),
  APP_ENCRYPTION_KEY: z.string().min(32),
  ADMIN_PASSWORD: z.string().min(1),
  APP_BASE_URL: z.string().url().optional().default("http://localhost:3000"),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  TELEGRAM_API_ID: process.env.TELEGRAM_API_ID,
  TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH,
  APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  APP_BASE_URL: process.env.APP_BASE_URL,
});
