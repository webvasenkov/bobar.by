import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

/** Implements the small prepared-statement interface used by the inquiry API. */
class Statement {
  constructor(private db: DatabaseSync, private sql: string, private values: SQLInputValue[] = []) {}
  bind(...values: SQLInputValue[]) { return new Statement(this.db, this.sql, values); }
  async first<T>() { return (this.db.prepare(this.sql).get(...this.values) as T | undefined) ?? null; }
  run() { return { meta: { changes: Number(this.db.prepare(this.sql).run(...this.values).changes) } }; }
}

let database: DatabaseSync | undefined;
function getConnection() {
  if (database) return database;
  const path = process.env.DATABASE_PATH ?? resolve("data/bobar.sqlite");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const connection = new DatabaseSync(path);
  try {
    connection.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    connection.exec("BEGIN IMMEDIATE");
    const version = connection.prepare("PRAGMA user_version").get()?.user_version;
    if (version === 0) {
      connection.exec(readFileSync(resolve("drizzle/0000_skinny_sersi.sql"), "utf8"));
      connection.exec("PRAGMA user_version=1");
    } else if (version !== 1) throw new Error("Unsupported database schema version");
    connection.exec("COMMIT");
  } catch (error) {
    if (connection.isTransaction) connection.exec("ROLLBACK");
    connection.close();
    throw error;
  }
  database = connection;
  return connection;
}

export const env = {
  get TELEGRAM_BOT_TOKEN() { return process.env.TELEGRAM_BOT_TOKEN; },
  get TELEGRAM_CHAT_ID() { return process.env.TELEGRAM_CHAT_ID; },
  get SITE_ORIGIN() { return process.env.SITE_ORIGIN ?? "https://bobar.by"; },
  CLIENT_IP_HEADER: "x-bobar-client-ip",
  DB: {
    prepare(sql: string) { return new Statement(getConnection(), sql); },
    async batch(statements: Statement[]) {
      const db = getConnection();
      db.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((statement) => statement.run());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  },
};
