import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getDb, resetDbForTests, initDb } from "../../src/db/connection";
import { migrateDatabase } from "../../src/db/schema";
import { allocateNextOrderId } from "../../src/services/order-id-service";
import { createTestApp, type TestAppContext } from "../helpers/test-app";

describe("database migration and sequencing", () => {
  let context: TestAppContext;

  beforeEach(async () => {
    context = await createTestApp();
  });

  afterEach(() => {
    context.cleanup();
  });

  it("backfills business_date for legacy orders during migration", async () => {
    context.cleanup();
    resetDbForTests();
    process.env.ALLOW_UNSAFE_HEADER_AUTH = "true";
    process.env.TEAMSFX_ENV = "local";
    process.env.BUSINESS_TIMEZONE = "Asia/Shanghai";
    await initDb();

    const db = getDb();
    db.exec(`
      DROP TABLE IF EXISTS orders;
      DROP TABLE IF EXISTS settings;
      DROP TABLE IF EXISTS order_sequences;
      DROP TABLE IF EXISTS payment_reconciliation_incidents;

      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        student_aad_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        pickup_window_id TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'confirmed',
        total_cents INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    db.prepare(
      `INSERT INTO orders (
        id, student_aad_id, student_name, pickup_window_id, payment_method, status,
        total_cents, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "LEGACY-001",
      "legacy-student",
      "Legacy Student",
      "mid-break",
      "pay-at-collect",
      "confirmed",
      500,
      "2026-04-03 16:30:00",
      "2026-04-03 16:30:00"
    );

    migrateDatabase(db);

    const row = db
      .prepare("SELECT business_date FROM orders WHERE id = ?")
      .get("LEGACY-001") as { business_date: string };
    expect(row.business_date).toBe("2026-04-04");
  });

  it("allocates stable daily order IDs from the sequence table", () => {
    const first = allocateNextOrderId("2026-04-04");
    const second = allocateNextOrderId("2026-04-04");
    const nextDay = allocateNextOrderId("2026-04-05");

    expect(first).toMatch(/^[A-Z]001$/);
    expect(second).toMatch(/^[A-Z]002$/);
    expect(nextDay).toMatch(/^[A-Z]001$/);
    expect(first[0]).toBe(second[0]);
    expect(first[0]).not.toBe(nextDay[0]);
  });

  it("backfills order sequences from legacy daily order IDs", async () => {
    context.cleanup();
    resetDbForTests();
    process.env.ALLOW_UNSAFE_HEADER_AUTH = "true";
    process.env.TEAMSFX_ENV = "local";
    process.env.BUSINESS_TIMEZONE = "Asia/Shanghai";
    await initDb();

    const db = getDb();
    db.exec(`
      DROP TABLE IF EXISTS orders;
      DROP TABLE IF EXISTS settings;
      DROP TABLE IF EXISTS order_sequences;
      DROP TABLE IF EXISTS payment_reconciliation_incidents;

      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        student_aad_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        pickup_window_id TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'confirmed',
        total_cents INTEGER NOT NULL,
        business_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    db.prepare(
      `INSERT INTO orders (
        id, student_aad_id, student_name, pickup_window_id, payment_method, status,
        total_cents, business_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "Q001",
      "legacy-student",
      "Legacy Student",
      "mid-break",
      "pay-at-collect",
      "confirmed",
      500,
      "2026-04-04",
      "2026-04-03 16:30:00",
      "2026-04-03 16:30:00"
    );
    db.prepare(
      `INSERT INTO orders (
        id, student_aad_id, student_name, pickup_window_id, payment_method, status,
        total_cents, business_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "Q002",
      "legacy-student",
      "Legacy Student",
      "mid-break",
      "pay-at-collect",
      "confirmed",
      600,
      "2026-04-04",
      "2026-04-03 17:00:00",
      "2026-04-03 17:00:00"
    );

    migrateDatabase(db);

    const nextSequence = db
      .prepare("SELECT next_sequence FROM order_sequences WHERE business_date = ?")
      .get("2026-04-04") as { next_sequence: number };
    expect(nextSequence.next_sequence).toBe(3);
    expect(allocateNextOrderId("2026-04-04")).toBe("Q003");
  });

  it("fails fast when async work is passed into a database transaction", () => {
    const db = getDb();

    expect(() =>
      db.transaction(async () => {
        db.exec("SELECT 1");
      })()
    ).toThrow("Async callbacks are not supported in database transactions");
  });
});
