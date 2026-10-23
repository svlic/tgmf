import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const execute = promisify(execFile);
let directory: string;
let keyPath: string;

beforeEach(() => {
  vi.resetModules();
  directory = mkdtempSync(join(tmpdir(), "tgmf-encryption-"));
  keyPath = join(directory, "nested", "app-encryption.key");
  vi.stubEnv("DATABASE_URL", join(directory, "nested", "app.db"));
  vi.stubEnv("APP_ENCRYPTION_KEY", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

it.each([undefined, ""])("persists a private key when APP_ENCRYPTION_KEY is %s and reuses it after restart", async (value) => {
  vi.stubEnv("APP_ENCRYPTION_KEY", value);
  const { encryptString } = await import("@/lib/crypto");
  const ciphertext = encryptString("saved Telegram session");
  const storedKey = readFileSync(keyPath, "utf8");
  expect(storedKey).toMatch(/^[a-f0-9]{64}$/);
  expect(statSync(keyPath).mode & 0o777).toBe(0o600);

  vi.resetModules();
  const { decryptString } = await import("@/lib/crypto");
  expect(decryptString(ciphertext)).toBe("saved Telegram session");
  expect(readFileSync(keyPath, "utf8")).toBe(storedKey);
  expect(readdirSync(join(directory, "nested"))).toEqual(["app-encryption.key"]);
});

it("prefers the existing environment key without replacing the stored key", async () => {
  mkdirSync(join(directory, "nested"));
  const fileKey = "persisted-key-".repeat(4);
  const configuredKey = "original-environment-key-".repeat(3);
  writeFileSync(keyPath, fileKey, { mode: 0o600 });
  vi.stubEnv("APP_ENCRYPTION_KEY", configuredKey);
  const { getAppEncryptionKey } = await import("@/lib/env");
  expect(getAppEncryptionKey()).toBe(configuredKey);
  expect(readFileSync(keyPath, "utf8")).toBe(fileKey);
});

it("rejects invalid explicit keys instead of silently using an automatic key", async () => {
  vi.stubEnv("APP_ENCRYPTION_KEY", "too-short");
  const { getAppEncryptionKey } = await import("@/lib/env");
  expect(() => getAppEncryptionKey()).toThrow(/at least 32/);
  expect(readdirSync(directory)).toEqual([]);
});

it("rejects a damaged key file without replacing it", async () => {
  mkdirSync(join(directory, "nested"));
  writeFileSync(keyPath, "damaged");
  const { getAppEncryptionKey } = await import("@/lib/env");
  expect(() => getAppEncryptionKey()).toThrow(/at least 32/);
  expect(readFileSync(keyPath, "utf8")).toBe("damaged");
});

it("shares the same persisted key across concurrently starting processes", async () => {
  const results = await Promise.all(Array.from({ length: 4 }, (_, index) => execute(
    process.execPath,
    ["--import", "tsx", "--eval", `
      const { encryptString } = require('./src/lib/crypto.ts');
      process.stdout.write(encryptString('process-${index}'));
    `],
    { env: { ...process.env, APP_ENCRYPTION_KEY: "" } },
  )));

  const { decryptString } = await import("@/lib/crypto");
  expect(results.map(({ stdout }) => decryptString(stdout))).toEqual([
    "process-0", "process-1", "process-2", "process-3",
  ]);
  expect(readdirSync(join(directory, "nested"))).toEqual(["app-encryption.key"]);
});
