import { z } from "zod";

const baseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).default("data/app.db"),
  TELEGRAM_API_ID: z.string().optional().default(""),
  TELEGRAM_API_HASH: z.string().optional().default(""),
});

const secretEnvSchema = z.object({
  APP_ENCRYPTION_KEY: z
    .string()
    .min(32, "APP_ENCRYPTION_KEY must be at least 32 characters and should be a server-side random secret, not a login password."),
  ADMIN_PASSWORD: z.string().min(1),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type SecretEnv = z.infer<typeof secretEnvSchema>;
export type AppEnv = BaseEnv & SecretEnv;

let cachedBaseEnv: BaseEnv | null = null;
let cachedSecretEnv: SecretEnv | null = null;

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

export function getSecretEnv(): SecretEnv {
  if (!cachedSecretEnv) {
    cachedSecretEnv = secretEnvSchema.parse({
      APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    });
  }

  return cachedSecretEnv;
}

export function getEnv(): AppEnv {
  return {
    ...getBaseEnv(),
    ...getSecretEnv(),
  };
}
