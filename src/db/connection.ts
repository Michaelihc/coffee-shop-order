import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "fs";
import path from "path";

/**
 * Compatibility wrapper around sql.js that exposes a better-sqlite3–like API.
 * This lets the rest of the codebase work unchanged while using a pure-JS
 * SQLite implementation (no native bindings → works on Azure F1 32-bit).
 */

type StatementParams = readonly unknown[] | Record<string, unknown>;
interface RawStatement {
  bind(values: StatementParams): void;
  free(): void;
  get(): unknown[];
  getColumnNames(): string[];
  step(): boolean;
}

interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

interface Statement<T = unknown> {
  get(...params: unknown[]): T | undefined;
  all(...params: unknown[]): T[];
  run(...params: unknown[]): RunResult;
}

export interface CompatDatabase {
  prepare<T = unknown>(sql: string): Statement<T>;
  exec(sql: string): void;
  pragma(pragma: string): unknown;
  transaction<T>(fn: () => T): () => T;
  close(): void;
}

let db: CompatDatabase | null = null;
let sqlDb: SqlJsDatabase | null = null;
let dbPath: string = "";
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function clearDbState() {
  db = null;
  sqlDb = null;
  dbPath = "";
  initPromise = null;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (sqlDb && dbPath) {
      const data = sqlDb.export();
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(dbPath, Buffer.from(data));
    }
  }, 500);
}

function forceSave() {
  if (saveTimer) clearTimeout(saveTimer);
  if (sqlDb && dbPath) {
    const data = sqlDb.export();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dbPath, Buffer.from(data));
  }
}

function bindStatement(stmt: RawStatement, params: unknown[]): void {
  const candidate = params.length === 1 ? params[0] : params;
  const boundValue: StatementParams = (
    candidate !== null &&
    typeof candidate === "object" &&
    !Array.isArray(candidate)
  )
    ? (candidate as Record<string, unknown>)
    : params;

  stmt.bind(boundValue);
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    value !== null &&
    typeof value === "object" &&
    "then" in value &&
    typeof (value as Promise<T>).then === "function"
  );
}

function rowsToObjects(stmt: RawStatement): Record<string, unknown>[] {
  const cols: string[] = stmt.getColumnNames();
  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    const vals = stmt.get();
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < cols.length; i++) {
      obj[cols[i]] = vals[i];
    }
    results.push(obj);
  }
  stmt.free();
  return results;
}

function createWrapper(raw: SqlJsDatabase): CompatDatabase {
  const wrapper: CompatDatabase = {
    prepare<T = unknown>(sql: string): Statement<T> {
      return {
        get(...params: unknown[]): T | undefined {
          const stmt = raw.prepare(sql) as unknown as RawStatement;
          bindStatement(stmt, params);
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const obj: Record<string, unknown> = {};
            for (let i = 0; i < cols.length; i++) {
              obj[cols[i]] = vals[i];
            }
            stmt.free();
            return obj as T;
          }
          stmt.free();
          return undefined;
        },
        all(...params: unknown[]): T[] {
          const stmt = raw.prepare(sql) as unknown as RawStatement;
          bindStatement(stmt, params);
          const results = rowsToObjects(stmt);
          return results as T[];
        },
        run(...params: unknown[]): RunResult {
          const candidate = params.length === 1 ? params[0] : params;
          const boundValue: StatementParams = (
            candidate !== null &&
            typeof candidate === "object" &&
            !Array.isArray(candidate)
          )
            ? (candidate as Record<string, unknown>)
            : params;
          raw.run(sql, boundValue);
          const changes = raw.getRowsModified();
          // sql.js doesn't expose last_insert_rowid directly through run,
          // so we query it separately
          const lastIdStmt = raw.prepare("SELECT last_insert_rowid() as id");
          lastIdStmt.step();
          const lastId = lastIdStmt.get()[0] as number;
          lastIdStmt.free();
          debouncedSave();
          return { changes, lastInsertRowid: lastId };
        },
      };
    },

    exec(sql: string): void {
      raw.exec(sql);
      debouncedSave();
    },

    pragma(pragma: string): unknown {
      try {
        const results = raw.exec(`PRAGMA ${pragma}`);
        if (results.length > 0 && results[0].values.length > 0) {
          return results[0].values[0][0];
        }
      } catch {
        // Some pragmas (like WAL) aren't supported in sql.js; silently ignore
      }
      return undefined;
    },

    transaction<T>(fn: () => T): () => T {
      const wrapped = () => {
        raw.run("BEGIN TRANSACTION");
        try {
          const result = fn();
          if (isPromiseLike(result)) {
            raw.run("ROLLBACK");
            throw new Error("Async callbacks are not supported in database transactions");
          }
          raw.run("COMMIT");
          forceSave();
          return result;
        } catch (e) {
          try {
            raw.run("ROLLBACK");
          } catch {
            // Ignore rollback errors if the transaction was already closed.
          }
          throw e;
        }
      };
      return wrapped;
    },

    close(): void {
      forceSave();
      raw.close();
    },
  };
  return wrapper;
}

let initPromise: Promise<void> | null = null;

/**
 * Initialize the database. Must be called (and awaited) once at startup
 * before getDb() is used.
 */
export async function initDb(): Promise<void> {
  if (db) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs();

    dbPath =
      process.env.DB_PATH ||
      path.join(__dirname, "../../data/coffee-shop.db");

    let rawDb: SqlJsDatabase;
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      rawDb = new SQL.Database(buffer);
    } else {
      rawDb = new SQL.Database();
    }

    sqlDb = rawDb;
    db = createWrapper(rawDb);

    // foreign keys
    db.pragma("foreign_keys = ON");
  })();

  return initPromise;
}

export function getDb(): CompatDatabase {
  if (!db) {
    throw new Error(
      "Database not initialized. Call await initDb() at startup before using getDb()."
    );
  }
  return db;
}

export function resetDbForTests(): void {
  if (db) {
    db.close();
  }
  clearDbState();
}
