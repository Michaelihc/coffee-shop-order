import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { createOrder } from "../../src/services/order-service";
import { updateOrderStatus } from "../../src/services/order-service";
import { setPaymentProvider } from "../../src/services/payment";
import { isWindowAcceptingOrders } from "../../src/services/capacity";
import type { PaymentProvider } from "../../src/services/payment";
import { createTestApp, getTestDb, type TestAppContext } from "../helpers/test-app";

describe("order-service stability", () => {
  let context: TestAppContext;

  beforeEach(async () => {
    context = await createTestApp();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setPaymentProvider(null);
    context.cleanup();
  });

  it("creates an order successfully and stores the Asia/Shanghai business date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T16:30:00.000Z"));

    const result = await createOrder("student-1", "Student One", {
      pickupWindowId: "mid-break",
      paymentMethod: "student-card",
      items: [{ menuItemId: "water", quantity: 2 }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const stored = getTestDb()
        .prepare("SELECT business_date, payment_ref FROM orders WHERE id = ?")
        .get(result.order.id) as { business_date: string; payment_ref: string };
      const incidentCount = getTestDb()
        .prepare("SELECT COUNT(*) as n FROM payment_reconciliation_incidents")
        .get() as { n: number };

      expect(stored.business_date).toBe("2026-04-04");
      expect(stored.payment_ref).toMatch(/^STUB-student-card-/);
      expect(incidentCount.n).toBe(0);
    }
  });

  it("refunds a charge when post-charge stock validation fails", async () => {
    let refundCalls = 0;
    const provider: PaymentProvider = {
      async charge() {
        getTestDb()
          .prepare("UPDATE menu_items SET stock_count = 0 WHERE id = ?")
          .run("water");
        return { ok: true, transactionRef: "tx-stock-failure" };
      },
      async refund() {
        refundCalls += 1;
        return { ok: true, transactionRef: "refund-stock-failure" };
      },
    };
    setPaymentProvider(provider);

    const result = await createOrder("student-2", "Student Two", {
      pickupWindowId: "mid-break",
      paymentMethod: "student-card",
      items: [{ menuItemId: "water", quantity: 1 }],
    });

    expect(result).toEqual({
      ok: false,
      error: "Water Bottle is out of stock",
    });
    expect(refundCalls).toBe(1);

    const incidentCount = getTestDb()
      .prepare("SELECT COUNT(*) as n FROM payment_reconciliation_incidents")
      .get() as { n: number };
    expect(incidentCount.n).toBe(0);
  });

  it("skips duplicate legacy order IDs instead of failing after the stub payment step", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T16:30:00.000Z"));

    getTestDb()
      .prepare(
        `INSERT INTO orders (
          id, student_aad_id, student_name, pickup_window_id, payment_method, status,
          total_cents, business_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "Q001",
        "legacy-student",
        "Legacy Student",
        "mid-break",
        "pay-at-collect",
        "confirmed",
        500,
        "2026-04-04",
        "2026-04-03T16:20:00.000Z",
        "2026-04-03T16:20:00.000Z"
      );

    getTestDb().exec("DELETE FROM order_sequences");

    const result = await createOrder("student-6", "Student Six", {
      pickupWindowId: "mid-break",
      paymentMethod: "student-card",
      items: [{ menuItemId: "water", quantity: 1 }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.id).toBe("Q002");
    }
  });

  it("records a reconciliation incident when refunding a failed order also fails", async () => {
    const provider: PaymentProvider = {
      async charge() {
        getTestDb()
          .prepare("UPDATE menu_items SET stock_count = 0 WHERE id = ?")
          .run("water");
        return { ok: true, transactionRef: "tx-refund-failure" };
      },
      async refund() {
        return { ok: false, reason: "gateway offline" };
      },
    };
    setPaymentProvider(provider);

    const result = await createOrder("student-3", "Student Three", {
      pickupWindowId: "mid-break",
      paymentMethod: "student-card",
      items: [{ menuItemId: "water", quantity: 1 }],
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Payment was processed but the order could not be completed. Staff has been notified to reconcile the transaction.",
    });

    const incident = getTestDb()
      .prepare(
        "SELECT transaction_ref, incident_type, details FROM payment_reconciliation_incidents"
      )
      .get() as { transaction_ref: string; incident_type: string; details: string };

    expect(incident.transaction_ref).toBe("tx-refund-failure");
    expect(incident.incident_type).toBe("refund_failed_after_order_create_failure");
    expect(incident.details).toContain("gateway offline");
  });

  it("records a reconciliation incident when the payment provider throws during charge", async () => {
    const provider: PaymentProvider = {
      async charge() {
        throw new Error("gateway timeout");
      },
      async refund() {
        return { ok: true, transactionRef: "unused" };
      },
    };
    setPaymentProvider(provider);

    const result = await createOrder("student-10", "Student Ten", {
      pickupWindowId: "mid-break",
      paymentMethod: "student-card",
      items: [{ menuItemId: "water", quantity: 1 }],
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Payment could not be confirmed. Staff has been notified to reconcile the transaction if a charge was attempted.",
    });

    const incident = getTestDb()
      .prepare(
        "SELECT incident_type, details FROM payment_reconciliation_incidents LIMIT 1"
      )
      .get() as { incident_type: string; details: string };

    expect(incident.incident_type).toBe("order_create_charge_failed");
    expect(incident.details).toContain("gateway timeout");
  });

  it("refunds paid orders when staff cancel them", async () => {
    let refundCalls = 0;
    const provider: PaymentProvider = {
      async charge() {
        return { ok: true, transactionRef: "tx-cancel-refund" };
      },
      async refund() {
        refundCalls += 1;
        return { ok: true, transactionRef: "refund-cancel-refund" };
      },
    };
    setPaymentProvider(provider);

    const created = await createOrder("student-8", "Student Eight", {
      pickupWindowId: "mid-break",
      paymentMethod: "student-card",
      items: [{ menuItemId: "water", quantity: 1 }],
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const result = await updateOrderStatus(created.order.id, "cancelled", {
      cancelReason: "other",
      cancelNote: "duplicate order",
    });

    expect(result).toEqual({
      ok: true,
      order: expect.objectContaining({
        id: created.order.id,
        status: "cancelled",
        cancelReason: "other",
        cancelNote: "duplicate order",
      }),
    });
    expect(refundCalls).toBe(1);
  });

  it("records a reconciliation incident when refunding a cancelled paid order fails", async () => {
    const provider: PaymentProvider = {
      async charge() {
        return { ok: true, transactionRef: "tx-cancel-refund-failure" };
      },
      async refund() {
        return { ok: false, reason: "processor unavailable" };
      },
    };
    setPaymentProvider(provider);

    const created = await createOrder("student-9", "Student Nine", {
      pickupWindowId: "mid-break",
      paymentMethod: "student-card",
      items: [{ menuItemId: "water", quantity: 1 }],
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const result = await updateOrderStatus(created.order.id, "cancelled", {
      cancelReason: "out-of-stock",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.status).toBe("cancelled");
      expect(result.warning).toBe(
        "Order cancelled, but the refund could not be completed automatically. Staff has been notified to reconcile the payment."
      );
    }

    const incident = getTestDb()
      .prepare(
        `SELECT transaction_ref, incident_type, details
         FROM payment_reconciliation_incidents
         WHERE order_id = ?`
      )
      .get(created.order.id) as { transaction_ref: string; incident_type: string; details: string };

    expect(incident.transaction_ref).toBe("tx-cancel-refund-failure");
    expect(incident.incident_type).toBe("refund_failed_after_order_cancel");
    expect(incident.details).toContain("processor unavailable");
  });

  it("returns a stub-safe failure message when persistence fails after a simulated charge", async () => {
    const provider: PaymentProvider = {
      mode: "stub",
      async charge() {
        return { ok: true, transactionRef: "tx-stub-persist-failure" };
      },
      async refund() {
        throw new Error("refund should not be called for stub mode");
      },
    };
    setPaymentProvider(provider);

    const db = getTestDb();
    const originalTransaction = db.transaction.bind(db);
    let transactionCallCount = 0;
    const transactionSpy = vi
      .spyOn(db, "transaction")
      .mockImplementation(((fn: (...args: unknown[]) => unknown) => {
        transactionCallCount += 1;
        if (transactionCallCount === 1) {
          return originalTransaction(fn);
        }

        return ((..._args: unknown[]) => {
          throw new Error("synthetic persist failure");
        }) as ReturnType<typeof originalTransaction>;
      }) as typeof db.transaction);

    const result = await createOrder("student-7", "Student Seven", {
      pickupWindowId: "mid-break",
      paymentMethod: "student-card",
      items: [{ menuItemId: "water", quantity: 1 }],
    });

    expect(result).toEqual({
      ok: false,
      error: "Failed to create order. No payment was taken. Please try again.",
    });

    transactionSpy.mockRestore();
  });

  it("records a reconciliation incident when refunding after a persistence failure throws", async () => {
    const provider: PaymentProvider = {
      async charge() {
        return { ok: true, transactionRef: "tx-refund-exception" };
      },
      async refund() {
        throw new Error("refund transport offline");
      },
    };
    setPaymentProvider(provider);

    const db = getTestDb();
    const originalTransaction = db.transaction.bind(db);
    let transactionCallCount = 0;
    const transactionSpy = vi
      .spyOn(db, "transaction")
      .mockImplementation(((fn: (...args: unknown[]) => unknown) => {
        transactionCallCount += 1;
        if (transactionCallCount === 1) {
          return originalTransaction(fn);
        }

        return ((..._args: unknown[]) => {
          throw new Error("synthetic persist failure");
        }) as ReturnType<typeof originalTransaction>;
      }) as typeof db.transaction);

    const result = await createOrder("student-11", "Student Eleven", {
      pickupWindowId: "mid-break",
      paymentMethod: "student-card",
      items: [{ menuItemId: "water", quantity: 1 }],
    });

    expect(result).toEqual({
      ok: false,
      error:
        "Payment was processed but the order could not be completed. Staff has been notified to reconcile the transaction.",
    });

    const incident = getTestDb()
      .prepare(
        "SELECT transaction_ref, incident_type, details FROM payment_reconciliation_incidents"
      )
      .get() as { transaction_ref: string; incident_type: string; details: string };

    expect(incident.transaction_ref).toBe("tx-refund-exception");
    expect(incident.incident_type).toBe("refund_failed_after_order_create_failure");
    expect(incident.details).toContain("refund transport offline");

    transactionSpy.mockRestore();
  });

  it("enforces daily spend using business_date instead of UTC date slices", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T16:30:00.000Z"));

    getTestDb()
      .prepare(
        `INSERT INTO orders (
          id, student_aad_id, student_name, pickup_window_id, payment_method, status,
          total_cents, business_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "SPEND-001",
        "student-4",
        "Student Four",
        "mid-break",
        "pay-at-collect",
        "confirmed",
        29900,
        "2026-04-04",
        "2026-04-03T16:15:00.000Z",
        "2026-04-03T16:15:00.000Z"
      );

    const result = await createOrder("student-4", "Student Four", {
      pickupWindowId: "mid-break",
      paymentMethod: "pay-at-collect",
      items: [{ menuItemId: "water", quantity: 1 }],
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toContain("Daily spending limit exceeded");
    }
  });

  it("uses business_date for made-to-order capacity checks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T16:30:00.000Z"));

    getTestDb()
      .prepare(
        `INSERT INTO orders (
          id, student_aad_id, student_name, pickup_window_id, payment_method, status,
          total_cents, business_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "CAP-001",
        "student-5",
        "Student Five",
        "mid-break",
        "pay-at-collect",
        "confirmed",
        5250,
        "2026-04-04",
        "2026-04-03T16:20:00.000Z",
        "2026-04-03T16:20:00.000Z"
      );
    getTestDb()
      .prepare(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, price_cents, quantity, item_class)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run("CAP-001", "latte", "Latte", 350, 15, "made-to-order");

    const result = isWindowAcceptingOrders("mid-break", true);
    expect(result).toEqual({
      ok: false,
      reason: "Pickup window is at capacity for made-to-order items",
    });
  });
});
