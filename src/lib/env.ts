import { randomBytes } from "node:crypto";
import { linkSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
    const configuredKey = process.env.APP_ENCRYPTION_KEY;
    if (configuredKey) {
      cachedAppEncryptionKey = appEncryptionKeySchema.parse(configuredKey);
      return cachedAppEncryptionKey;
    }

    const { DATABASE_URL } = getBaseEnv();
    const directory = DATABASE_URL === ":memory:" ? resolve("data") : dirname(resolve(DATABASE_URL));
    const keyPath = join(directory, "app-encryption.key");

    try {
      cachedAppEncryptionKey = appEncryptionKeySchema.parse(readFileSync(keyPath, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      mkdirSync(directory, { recursive: true });
      const temporaryPath = `${keyPath}.${randomBytes(16).toString("hex")}.tmp`;
      writeFileSync(temporaryPath, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
      try {
        try {
          // Publish a complete file without replacing a concurrent web/worker winner.
          linkSync(temporaryPath, keyPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
            throw error;
          }
        }
      } finally {
        unlinkSync(temporaryPath);
      }

      cachedAppEncryptionKey = appEncryptionKeySchema.parse(readFileSync(keyPath, "utf8"));
    }
  }

  return cachedAppEncryptionKey;
}
