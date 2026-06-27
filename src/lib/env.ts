import { z } from "zod";

const baseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).default("data/app.db"),
  TELEGRAM_API_ID: z.string().optional().default(""),
  TELEGRAM_API_HASH: z.string().optional().default(""),
});

const appEncryptionKeySchema = z
  .string()
  .min(32, "APP_ENCRYPTION_KEY must be at least 32 characters and should be a server-side random secret, not a login password.");

const adminPasswordSchema = z.string().min(1);

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type SecretEnv = {
  APP_ENCRYPTION_KEY: string;
  ADMIN_PASSWORD: string;
};

let cachedBaseEnv: BaseEnv | null = null;
let cachedSecretEnv: SecretEnv | null = null;
let cachedAppEncryptionKey: string | null = null;
let cachedAdminPassword: string | null = null;

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

export function getAdminPassword(): string {
  if (!cachedAdminPassword) {
    cachedAdminPassword = adminPasswordSchema.parse(process.env.ADMIN_PASSWORD);
  }

  return cachedAdminPassword;
}

export function getSecretEnv(): SecretEnv {
  if (!cachedSecretEnv) {
    cachedSecretEnv = {
      APP_ENCRYPTION_KEY: getAppEncryptionKey(),
      ADMIN_PASSWORD: getAdminPassword(),
    };
  }

  return cachedSecretEnv;
}
