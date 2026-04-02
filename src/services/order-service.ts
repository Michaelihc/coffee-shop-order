import { getDb } from "../db/connection";
import { isWindowAcceptingOrders } from "./capacity";
import {
  checkAndReserveStock,
  getMenuItemById,
  restockItems,
} from "./inventory-service";
import { assignGridSlot, clearGridSlotByOrder } from "./grid-service";
import { getPaymentProvider } from "./payment";
import { getSettingInt } from "./settings-service";
import type { CancelReason, Order, OrderItem, OrderStatus } from "../types/models";
import type { CreateOrderRequest } from "../types/api";

interface OrderRow {
  id: string;
  student_aad_id: string;
  student_name: string;
  pickup_window_id: string;
  payment_method: string;
  status: string;
  pickup_code: string | null;
  grid_slot: string | null;
  total_cents: number;
  payment_ref: string | null;
  payment_settled_at: string | null;
  cancel_reason: string | null;
  cancel_note: string | null;
  created_at: string;
  updated_at: string;
  ready_at: string | null;
  collected_at: string | null;
  notes: string | null;
}

interface OrderItemRow {
  id: number;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  price_cents: number;
  quantity: number;
  item_class: string;
}

// Characters that avoid ambiguity (no 0/O, 1/I/L)
const PICKUP_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CANCEL_REASONS = new Set<CancelReason>(["out-of-stock", "over-capacity", "other"]);

function generatePickupCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += PICKUP_CODE_CHARS[Math.floor(Math.random() * PICKUP_CODE_CHARS.length)];
  }
  return code;
}

function generateOrderId(): string {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  // Letter prefix cycles A-Z daily based on day of year
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const letter = String.fromCharCode(65 + (dayOfYear % 26));

  // Count today's orders for sequence number
  const row = db
    .prepare(
      "SELECT COUNT(*) as n FROM orders WHERE date(created_at) = ?"
    )
    .get(today) as { n: number };

  const seq = String(row.n + 1).padStart(3, "0");
  return `${letter}${seq}`;
}

function validateCreateOrderRequest(
  input: unknown
): { ok: true; value: CreateOrderRequest } | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Invalid order payload" };
  }

  const req = input as Partial<CreateOrderRequest>;
  if (!req.pickupWindowId || typeof req.pickupWindowId !== "string") {
    return { ok: false, error: "pickupWindowId is required" };
  }
  if (
    req.paymentMethod !== "student-card" &&
    req.paymentMethod !== "pay-at-collect"
  ) {
    return { ok: false, error: "paymentMethod is invalid" };
  }
  if (!Array.isArray(req.items) || req.items.length === 0) {
    return { ok: false, error: "items must contain at least one entry" };
  }

  const items: CreateOrderRequest["items"] = [];
  for (const item of req.items) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Each item must be an object" };
    }

    const candidate = item as { menuItemId?: unknown; quantity?: unknown };
    if (!candidate.menuItemId || typeof candidate.menuItemId !== "string") {
      return { ok: false, error: "menuItemId is required for each item" };
    }

    const quantity = Number(candidate.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { ok: false, error: `Quantity for ${candidate.menuItemId} must be a positive integer` };
    }

    items.push({
      menuItemId: candidate.menuItemId,
      quantity,
    });
  }

  if (req.notes !== undefined && req.notes !== null && typeof req.notes !== "string") {
    return { ok: false, error: "notes must be a string" };
  }

  return {
    ok: true,
    value: {
      pickupWindowId: req.pickupWindowId,
      paymentMethod: req.paymentMethod,
      items,
      notes: req.notes?.trim() || undefined,
    },
  };
}

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    studentAadId: row.student_aad_id,
    studentName: row.student_name,
    pickupWindowId: row.pickup_window_id,
    paymentMethod: row.payment_method as Order["paymentMethod"],
    status: row.status as OrderStatus,
    pickupCode: row.pickup_code,
    gridSlot: row.grid_slot,
    totalCents: row.total_cents,
    paymentRef: row.payment_ref,
    paymentSettledAt: row.payment_settled_at,
    cancelReason: (row.cancel_reason as CancelReason | null) ?? null,
    cancelNote: row.cancel_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readyAt: row.ready_at,
    collectedAt: row.collected_at,
    notes: row.notes,
  };
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function getStudentDailySpendCents(studentId: string, date = new Date().toISOString().slice(0, 10)): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(total_cents), 0) as total
       FROM orders
       WHERE student_aad_id = ?
         AND status != 'cancelled'
         AND date(created_at) = ?`
    )
    .get(studentId, date) as { total: number };

  return row.total ?? 0;
}

function rowToOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    menuItemId: row.menu_item_id,
    itemName: row.item_name,
    priceCents: row.price_cents,
    quantity: row.quantity,
    itemClass: row.item_class as OrderItem["itemClass"],
  };
}

export async function createOrder(
  studentId: string,
  studentName: string,
  input: CreateOrderRequest | unknown
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  const validation = validateCreateOrderRequest(input);
  if (validation.ok === false) {
    return { ok: false, error: validation.error };
  }

  const req = validation.value;
  const db = getDb();

  // Resolve items and calculate total
  const resolvedItems: {
    menuItemId: string;
    quantity: number;
    name: string;
    priceCents: number;
    itemClass: string;
  }[] = [];

  for (const item of req.items) {
    const menuItem = getMenuItemById(item.menuItemId);
    if (!menuItem) return { ok: false, error: `Item not found: ${item.menuItemId}` };
    if (!menuItem.isAvailable)
      return { ok: false, error: `${menuItem.name} is not available` };
    resolvedItems.push({
      menuItemId: menuItem.id,
      quantity: item.quantity,
      name: menuItem.name,
      priceCents: menuItem.priceCents,
      itemClass: menuItem.itemClass,
    });
  }

  if (resolvedItems.length === 0) {
    return { ok: false, error: "At least one valid item is required" };
  }

  const hasMadeToOrder = resolvedItems.some((i) => i.itemClass === "made-to-order");

  // Check order limits
  const totalQuantity = resolvedItems.reduce((sum, i) => sum + i.quantity, 0);
  const maxItems = getSettingInt("max_items_per_order", 10);
  if (totalQuantity > maxItems) {
    return { ok: false, error: `Order exceeds maximum of ${maxItems} items` };
  }

  const totalCents = resolvedItems.reduce(
    (sum, i) => sum + i.priceCents * i.quantity,
    0
  );

  const maxTotal = getSettingInt("max_order_total_cents", 25000);
  if (totalCents > maxTotal) {
    return { ok: false, error: `Order exceeds maximum of ¥${(maxTotal / 100).toFixed(2)}` };
  }

  const dailySpendLimit = getSettingInt("daily_spend_limit_cents", 30000);
  const spentToday = getStudentDailySpendCents(studentId);
  if (spentToday + totalCents > dailySpendLimit) {
    return {
      ok: false,
      error: `Daily spending limit exceeded. Limit: ${formatUsd(dailySpendLimit)}. Already ordered today: ${formatUsd(spentToday)}`,
    };
  }

  // Check window capacity
  const windowCheck = isWindowAcceptingOrders(req.pickupWindowId, hasMadeToOrder);
  if (!windowCheck.ok) return { ok: false, error: windowCheck.reason! };

  // Process payment
  const orderId = generateOrderId();
  const payment = getPaymentProvider();
  const paymentResult = await payment.charge({
    studentId,
    studentName,
    amountCents: totalCents,
    orderId,
    method: req.paymentMethod,
  });

  if (!paymentResult.ok) {
    return { ok: false, error: `Payment failed: ${(paymentResult as { ok: false; reason: string }).reason}` };
  }

  // Reserve stock (inside transaction)
  const txResult = db.transaction(() => {
    const stockResult = checkAndReserveStock(
      resolvedItems.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
    );
    if (!stockResult.ok) {
      return { ok: false as const, error: `${stockResult.failedItem} is out of stock` };
    }

    const paymentSettledAt =
      req.paymentMethod === "student-card" ? new Date().toISOString() : null;

    // Insert order
    db.prepare(
      `INSERT INTO orders (id, student_aad_id, student_name, pickup_window_id, payment_method, status, total_cents, payment_ref, payment_settled_at, notes)
       VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)`
    ).run(
      orderId,
      studentId,
      studentName,
      req.pickupWindowId,
      req.paymentMethod,
      totalCents,
      paymentResult.transactionRef,
      paymentSettledAt,
      req.notes || null
    );

    // Insert order items
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, menu_item_id, item_name, price_cents, quantity, item_class)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const item of resolvedItems) {
      insertItem.run(orderId, item.menuItemId, item.name, item.priceCents, item.quantity, item.itemClass);
    }

    return null; // success
  })();

  if (txResult !== null) return txResult;

  const order = getOrderById(orderId)!;
  return { ok: true, order };
}

export function getOrderById(orderId: string): Order | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as OrderRow | undefined;
  if (!row) return null;

  const order = rowToOrder(row);
  order.items = getOrderItems(orderId);
  return order;
}

export function getOrderItems(orderId: string): OrderItem[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .all(orderId) as OrderItemRow[];
  return rows.map(rowToOrderItem);
}

export function getStudentOrders(studentId: string, options?: { allTime?: boolean }): Order[] {
  const db = getDb();
  let sql: string;
  let params: unknown[];

  if (options?.allTime) {
    sql = "SELECT * FROM orders WHERE student_aad_id = ? ORDER BY created_at DESC";
    params = [studentId];
  } else {
    const today = new Date().toISOString().slice(0, 10);
    sql = "SELECT * FROM orders WHERE student_aad_id = ? AND date(created_at) = ? ORDER BY created_at DESC";
    params = [studentId, today];
  }

  const rows = db.prepare(sql).all(...params) as OrderRow[];
  return rows.map((row) => {
    const order = rowToOrder(row);
    order.items = getOrderItems(order.id);
    return order;
  });
}

export function getAdminOrders(filters?: {
  status?: string;
  windowId?: string;
  date?: string;
}): Order[] {
  const db = getDb();
  const targetDate = filters?.date || new Date().toISOString().slice(0, 10);
  let sql = "SELECT * FROM orders WHERE date(created_at) = ?";
  const params: unknown[] = [targetDate];

  if (filters?.status) {
    const statuses = filters.status.split(",");
    sql += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  }
  if (filters?.windowId) {
    sql += " AND pickup_window_id = ?";
    params.push(filters.windowId);
  }

  sql += " ORDER BY created_at DESC";

  const rows = db.prepare(sql).all(...params) as OrderRow[];
  return rows.map((row) => {
    const order = rowToOrder(row);
    order.items = getOrderItems(order.id);
    return order;
  });
}

export function getOrderCounts(): Record<OrderStatus, number> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = db
    .prepare(
      "SELECT status, COUNT(*) as n FROM orders WHERE date(created_at) = ? GROUP BY status"
    )
    .all(today) as { status: string; n: number }[];

  const counts: Record<string, number> = {
    confirmed: 0,
    preparing: 0,
    ready: 0,
    collected: 0,
    cancelled: 0,
  };
  for (const row of rows) {
    counts[row.status] = row.n;
  }
  return counts as Record<OrderStatus, number>;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["collected", "cancelled"],
};

export function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  options?: { cancelReason?: string; cancelNote?: string | null }
): { ok: true; order: Order } | { ok: false; error: string } {
  const db = getDb();
  const order = getOrderById(orderId);
  if (!order) return { ok: false, error: "Order not found" };

  const allowed = VALID_TRANSITIONS[order.status];
  if (!allowed || !allowed.includes(newStatus)) {
    return {
      ok: false,
      error: `Cannot transition from ${order.status} to ${newStatus}`,
    };
  }

  const now = new Date().toISOString();
  const cancelReason =
    typeof options?.cancelReason === "string" ? options.cancelReason.trim() : "";
  const cancelNote =
    typeof options?.cancelNote === "string" ? options.cancelNote.trim() : "";

  if (newStatus === "cancelled") {
    if (!CANCEL_REASONS.has(cancelReason as CancelReason)) {
      return { ok: false, error: "A valid cancellation reason is required" };
    }
    if (cancelReason === "other" && !cancelNote) {
      return { ok: false, error: "Please provide a note for 'Other' cancellations" };
    }
  }

  try {
    db.transaction(() => {
      if (newStatus === "ready") {
        const slotId = assignGridSlot(orderId);
        if (!slotId) {
          throw new Error("No pickup grid slots are currently available");
        }
        const pickupCode = generatePickupCode();
        db.prepare(
          "UPDATE orders SET status = ?, pickup_code = ?, grid_slot = ?, ready_at = ?, updated_at = ? WHERE id = ?"
        ).run(newStatus, pickupCode, slotId, now, now, orderId);
      } else if (newStatus === "collected") {
        clearGridSlotByOrder(orderId);
        db.prepare(
          "UPDATE orders SET status = ?, collected_at = ?, updated_at = ? WHERE id = ?"
        ).run(newStatus, now, now, orderId);
      } else if (newStatus === "cancelled") {
        // Restock premade items
        if (order.items) {
          restockItems(
            order.items.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              itemClass: i.itemClass,
            }))
          );
        }
        clearGridSlotByOrder(orderId);
        db.prepare(
          "UPDATE orders SET status = ?, cancel_reason = ?, cancel_note = ?, updated_at = ? WHERE id = ?"
        ).run(newStatus, cancelReason, cancelNote || null, now, orderId);
      } else {
        db.prepare(
          "UPDATE orders SET status = ?, cancel_reason = NULL, cancel_note = NULL, updated_at = ? WHERE id = ?"
        ).run(newStatus, now, orderId);
      }
    })();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to update order status",
    };
  }

  return { ok: true, order: getOrderById(orderId)! };
}
