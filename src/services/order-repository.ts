import { getDb } from "../db/connection";
import type { CancelReason, Order, OrderItem, OrderStatus } from "../types/models";
import { getCurrentBusinessDate } from "./business-time-service";

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
  business_date: string | null;
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

function getOrderItemsByOrderIds(orderIds: string[]): Map<string, OrderItem[]> {
  const itemsByOrderId = new Map<string, OrderItem[]>();
  if (orderIds.length === 0) {
    return itemsByOrderId;
  }

  const db = getDb();
  const placeholders = orderIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`
    )
    .all(...orderIds) as OrderItemRow[];

  for (const row of rows) {
    const items = itemsByOrderId.get(row.order_id) ?? [];
    items.push(rowToOrderItem(row));
    itemsByOrderId.set(row.order_id, items);
  }

  return itemsByOrderId;
}

function attachOrderItems(rows: OrderRow[]): Order[] {
  const itemsByOrderId = getOrderItemsByOrderIds(rows.map((row) => row.id));

  return rows.map((row) => ({
    ...rowToOrder(row),
    items: itemsByOrderId.get(row.id) ?? [],
  }));
}

export function getOrderById(orderId: string): Order | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as OrderRow | undefined;

  if (!row) {
    return null;
  }

  return attachOrderItems([row])[0] ?? null;
}

export function getStudentOrders(studentId: string, options?: { allTime?: boolean }): Order[] {
  const db = getDb();
  let sql: string;
  let params: unknown[];

  if (options?.allTime) {
    sql = "SELECT * FROM orders WHERE student_aad_id = ? ORDER BY created_at DESC";
    params = [studentId];
  } else {
    sql = "SELECT * FROM orders WHERE student_aad_id = ? AND business_date = ? ORDER BY created_at DESC";
    params = [studentId, getCurrentBusinessDate()];
  }

  const rows = db.prepare(sql).all(...params) as OrderRow[];
  return attachOrderItems(rows);
}

export function getAdminOrders(filters?: {
  status?: string;
  windowId?: string;
  date?: string;
}): Order[] {
  const db = getDb();
  const targetDate = filters?.date || getCurrentBusinessDate();
  let sql = "SELECT * FROM orders WHERE business_date = ?";
  const params: unknown[] = [targetDate];

  if (filters?.status) {
    const statuses = filters.status
      .split(",")
      .map((status) => status.trim())
      .filter(Boolean);
    if (statuses.length > 0) {
      sql += ` AND status IN (${statuses.map(() => "?").join(",")})`;
      params.push(...statuses);
    }
  }
  if (filters?.windowId) {
    sql += " AND pickup_window_id = ?";
    params.push(filters.windowId);
  }

  sql += " ORDER BY created_at DESC";

  const rows = db.prepare(sql).all(...params) as OrderRow[];
  return attachOrderItems(rows);
}

export function getOrderCounts(targetDate = getCurrentBusinessDate()): Record<OrderStatus, number> {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT status, COUNT(*) as n FROM orders WHERE business_date = ? GROUP BY status"
    )
    .all(targetDate) as { status: string; n: number }[];

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
