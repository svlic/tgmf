import Database from "better-sqlite3";
import { dirname, isAbsolute, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { env } from "@/lib/env";
import { schemaStatements } from "@/lib/db/schema";

function resolveDatabasePath() {
  if (env.DATABASE_URL === ":memory:") {
    return env.DATABASE_URL;
  }

  return isAbsolute(env.DATABASE_URL)
    ? env.DATABASE_URL
    : resolve(process.cwd(), env.DATABASE_URL);
}

const databasePath = resolveDatabasePath();

if (databasePath !== ":memory:") {
  mkdirSync(dirname(databasePath), { recursive: true });
}

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

for (const statement of schemaStatements) {
  db.exec(statement);
}
