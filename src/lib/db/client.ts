import Database from "better-sqlite3";
import { dirname, isAbsolute, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { getBaseEnv } from "@/lib/env";
import { schemaStatements } from "@/lib/db/schema";

function resolveDatabasePath() {
  const { DATABASE_URL } = getBaseEnv();

  if (DATABASE_URL === ":memory:") {
    return DATABASE_URL;
  }

  return isAbsolute(DATABASE_URL)
    ? DATABASE_URL
    : resolve(process.cwd(), DATABASE_URL);
}

let database: Database.Database | null = null;

export function getDb() {
  if (!database) {
    const databasePath = resolveDatabasePath();

    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    database = new Database(databasePath);
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");

    for (const statement of schemaStatements) {
      database.exec(statement);
    }
  }

  return database;
}
