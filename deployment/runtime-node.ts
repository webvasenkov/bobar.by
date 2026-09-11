import { mkdirSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

/** Implements the prepared-statement interface shared by the site's APIs. */
class Statement {
  constructor(private db: DatabaseSync, private sql: string, private values: SQLInputValue[] = []) {}
  bind(...values: SQLInputValue[]) { return new Statement(this.db, this.sql, values); }
  async first<T>() { return (this.db.prepare(this.sql).get(...this.values) as T | undefined) ?? null; }
  async all<T>() { return { results: this.db.prepare(this.sql).all(...this.values) as T[] }; }
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
    const version = Number(connection.prepare("PRAGMA user_version").get()?.user_version);
    const migrations = ["0000_skinny_sersi.sql", "0001_cynical_black_cat.sql", "0002_big_adam_destine.sql", "0003_image_optimization.sql"];
    if (version > migrations.length) throw new Error("Unsupported database schema version");
    for (let index = version; index < migrations.length; index++) {
      connection.exec(readFileSync(resolve("drizzle", migrations[index]), "utf8"));
      connection.exec(`PRAGMA user_version=${index + 1}`);
    }
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
  get ADMIN_USERNAME() { return process.env.ADMIN_USERNAME; },
  get ADMIN_PASSWORD_HASH() { return process.env.ADMIN_PASSWORD_HASH; },
  get TELEGRAM_BOT_TOKEN() { return process.env.TELEGRAM_BOT_TOKEN; },
  get TELEGRAM_CHAT_ID() { return process.env.TELEGRAM_CHAT_ID; },
  get SITE_ORIGIN() { return process.env.SITE_ORIGIN ?? "https://bobar.by"; },
  CLIENT_IP_HEADER: "x-bobar-client-ip",
  BUCKET: {
    async put(key: string, value: ArrayBuffer) {
      const directory = resolve(process.env.UPLOADS_PATH || "data/uploads");
      if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid image key");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(resolve(directory, key), new Uint8Array(value), { flag: "wx", mode: 0o600 });
    },
    async get(key: string) {
      if (!/^[a-f0-9-]{36}$/.test(key)) return null;
      try {
        const bytes = await readFile(resolve(process.env.UPLOADS_PATH || "data/uploads", key));
        return { body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
      } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
    },
    async delete(key: string) {
      if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("Invalid image key");
      await unlink(resolve(process.env.UPLOADS_PATH || "data/uploads", key));
    },
  },
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
