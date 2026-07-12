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

type TableInfoRow = {
  name: string;
};

function ensureColumn(db: Database.Database, tableName: string, columnName: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as TableInfoRow[];
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
}

function runCompatibilityMigrations(db: Database.Database) {
  ensureColumn(db, "telegram_accounts", "flood_wait_until", "flood_wait_until TEXT");
  ensureColumn(db, "sync_jobs", "allowed_media_types", "allowed_media_types TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "sync_jobs", "keyword_whitelist", "keyword_whitelist TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "sync_jobs", "keyword_blacklist", "keyword_blacklist TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "sync_jobs", "regex_whitelist", "regex_whitelist TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "sync_jobs", "regex_blacklist", "regex_blacklist TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "sync_jobs", "local_skips", "local_skips INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "sync_jobs", "send_attempts", "send_attempts INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "sync_jobs", "forward_attempts", "forward_attempts INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "sync_jobs", "forward_confirmed", "forward_confirmed INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "sync_jobs", "forward_unmapped", "forward_unmapped INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "sync_jobs", "flood_wait_events", "flood_wait_events INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "sync_jobs", "last_send_attempt_at", "last_send_attempt_at TEXT");

  db.transaction(() => {
    db.prepare(
      `UPDATE message_transfer_records
       SET status = 'warn'
       WHERE status = 'skipped' AND error_reason = 'Telegram did not return a target message id'`,
    ).run();
    db.prepare(
      `UPDATE sync_jobs
       SET last_error_code = NULL, last_error_message = NULL
       WHERE last_error_code = 'message_transfer_warn'
         AND last_error_message = 'Telegram did not return a target message id'`,
    ).run();
  })();
}

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
    runCompatibilityMigrations(database);
  }

  return database;
}
