import fs from "fs";
import path from "path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestApp, getTestDb, adminHeaders, type TestAppContext } from "../helpers/test-app";

describe("server routes", () => {
  let context: TestAppContext;

  beforeEach(async () => {
    context = await createTestApp();
  });

  afterEach(() => {
    context.cleanup();
  });

  it("requires authentication for CSV reports and serves them for admins", async () => {
    getTestDb()
      .prepare(
        `INSERT INTO orders (
          id, student_aad_id, student_name, pickup_window_id, payment_method, status,
          total_cents, business_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "BAL-001",
        "student-balance",
        "Balance Student",
        "mid-break",
        "pay-at-collect",
        "confirmed",
        450,
        "2026-04-04",
        "2026-04-04T01:00:00.000Z",
        "2026-04-04T01:00:00.000Z"
      );

    const unauthenticated = await request(context.app).get("/api/admin/reports/balance/csv");
    expect(unauthenticated.status).toBe(401);

    const response = await request(context.app)
      .get("/api/admin/reports/balance/csv")
      .set(adminHeaders());

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("student-balances.csv");
    expect(response.text).toContain("Balance Student");
  });

  it("returns a failure when staff try to clear a grid slot for an order that is not ready", async () => {
    getTestDb()
      .prepare(
        `INSERT INTO orders (
          id, student_aad_id, student_name, pickup_window_id, payment_method, status,
          total_cents, business_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "GRID-001",
        "student-grid",
        "Grid Student",
        "mid-break",
        "pay-at-collect",
        "confirmed",
        350,
        "2026-04-04",
        "2026-04-04T01:05:00.000Z",
        "2026-04-04T01:05:00.000Z"
      );
    getTestDb()
      .prepare(
        "UPDATE grid_slots SET is_occupied = 1, current_order_id = ? WHERE id = ?"
      )
      .run("GRID-001", "1");

    const response = await request(context.app)
      .patch("/api/admin/grid/1")
      .set(adminHeaders())
      .send({ clear: true });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Cannot transition from confirmed to collected",
    });

    const slot = getTestDb()
      .prepare("SELECT is_occupied, current_order_id FROM grid_slots WHERE id = ?")
      .get("1") as { is_occupied: number; current_order_id: string | null };
    expect(slot.is_occupied).toBe(1);
    expect(slot.current_order_id).toBe("GRID-001");
  });

  it("rejects unknown admin setting keys instead of persisting dead config", async () => {
    const response = await request(context.app)
      .patch("/api/admin/settings/not_a_real_setting")
      .set(adminHeaders())
      .send({ value: "123" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Setting not found" });

    const stored = getTestDb()
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("not_a_real_setting");
    expect(stored).toBeUndefined();
  });

  it("does not create an uploaded image file when the inventory item does not exist", async () => {
    const uploadsDir = path.join(context.tempDir, "images");
    const response = await request(context.app)
      .post("/api/admin/inventory/missing-item/image")
      .set(adminHeaders())
      .attach("image", Buffer.from("fake-png"), {
        filename: "menu.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Item not found" });

    const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
    expect(files).toEqual([]);
  });
});
