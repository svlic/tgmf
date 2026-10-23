import { z } from "zod";

const baseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).default("data/app.db"),
  TELEGRAM_API_ID: z.string().optional().default(""),
  TELEGRAM_API_HASH: z.string().optional().default(""),
});

const appEncryptionKeySchema = z
  .string()
  .min(32, "APP_ENCRYPTION_KEY must be at least 32 characters and should be a server-side random secret, not a login password.");

export type BaseEnv = z.infer<typeof baseEnvSchema>;

let cachedBaseEnv: BaseEnv | null = null;
let cachedAppEncryptionKey: string | null = null;

export function getBaseEnv(): BaseEnv {
  if (!cachedBaseEnv) {
    cachedBaseEnv = baseEnvSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL,
      TELEGRAM_API_ID: process.env.TELEGRAM_API_ID,
      TELEGRAM_API_HASH: process.env.TELEGRAM_API_HASH,
    });
  }

  return cachedBaseEnv;
}

export function getAppEncryptionKey(): string {
  if (!cachedAppEncryptionKey) {
    cachedAppEncryptionKey = appEncryptionKeySchema.parse(process.env.APP_ENCRYPTION_KEY);
  }

  return cachedAppEncryptionKey;
}
