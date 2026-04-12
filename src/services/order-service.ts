import { getDb } from "../db/connection";
import { getCurrentBusinessDate, getBusinessDate, toSqlTimestamp } from "./business-time-service";
import { allocateNextOrderId } from "./order-id-service";
import { isWindowAcceptingOrders } from "./capacity";
import {
  checkAndReserveStock,
  getMenuItemById,
  restockItems,
} from "./inventory-service";
import { assignGridSlot, clearGridSlotByOrder } from "./grid-service";
import { getPaymentProvider } from "./payment";
import {
  createPaymentReconciliationIncident,
  deletePaymentReconciliationIncident,
  recordPaymentReconciliationIncident,
  updatePaymentReconciliationIncident,
} from "./payment-reconciliation-service";
import { getSettingInt } from "./settings-service";
import { logError, logInfo, logWarn } from "./logger";
import type { CancelReason, Order, OrderStatus } from "../types/models";
import type { CreateOrderRequest } from "../types/api";
import { getOrderById } from "./order-repository";
import type { PaymentResult } from "./payment";

interface ResolvedOrderItem {
  menuItemId: string;
  quantity: number;
  name: string;
  priceCents: number;
  itemClass: string;
}

export type UpdateOrderStatusResult =
  | { ok: true; order: Order; warning?: string }
  | { ok: false; error: string };

class OrderCreationFailure extends Error {
  constructor(public readonly userMessage: string) {
    super(userMessage);
  }
}

const PICKUP_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CANCEL_REASONS = new Set<CancelReason>(["out-of-stock", "over-capacity", "other"]);

function generatePickupCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += PICKUP_CODE_CHARS[Math.floor(Math.random() * PICKUP_CODE_CHARS.length)];
  }
  return code;
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

function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getStudentDailySpendCents(studentId: string, businessDate = getCurrentBusinessDate()): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(total_cents), 0) as total
       FROM orders
       WHERE student_aad_id = ?
         AND status != 'cancelled'
         AND business_date = ?`
    )
    .get(studentId, businessDate) as { total: number };

  return row.total ?? 0;
}

function resolveOrderItems(req: CreateOrderRequest): { ok: true; items: ResolvedOrderItem[] } | { ok: false; error: string } {
  const resolvedItems: ResolvedOrderItem[] = [];

  for (const item of req.items) {
    const menuItem = getMenuItemById(item.menuItemId);
    if (!menuItem) {
      return { ok: false, error: `Item not found: ${item.menuItemId}` };
    }
    if (!menuItem.isAvailable) {
      return { ok: false, error: `${menuItem.name} is not available` };
    }

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

  return { ok: true, items: resolvedItems };
}

function validateOrderLimits(
  studentId: string,
  resolvedItems: ResolvedOrderItem[],
  businessDate: string
): { ok: true; totalCents: number; hasMadeToOrder: boolean } | { ok: false; error: string } {
  const hasMadeToOrder = resolvedItems.some((item) => item.itemClass === "made-to-order");
  const totalQuantity = resolvedItems.reduce((sum, item) => sum + item.quantity, 0);
  const maxItems = getSettingInt("max_items_per_order", 10);

  if (totalQuantity > maxItems) {
    return { ok: false, error: `Order exceeds maximum of ${maxItems} items` };
  }

  const totalCents = resolvedItems.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0
  );
  const maxTotal = getSettingInt("max_order_total_cents", 25000);
  if (totalCents > maxTotal) {
    return { ok: false, error: `Order exceeds maximum of ¥${(maxTotal / 100).toFixed(2)}` };
  }

  const dailySpendLimit = getSettingInt("daily_spend_limit_cents", 30000);
  const spentToday = getStudentDailySpendCents(studentId, businessDate);
  if (spentToday + totalCents > dailySpendLimit) {
    return {
      ok: false,
      error: `Daily spending limit exceeded. Limit: ${formatCurrency(dailySpendLimit)}. Already ordered today: ${formatCurrency(spentToday)}`,
    };
  }

  return { ok: true, totalCents, hasMadeToOrder };
}

async function refundCancelledOrder(
  order: Order,
  options?: { cancelReason?: string; cancelNote?: string | null }
): Promise<string | undefined> {
  if (order.paymentMethod !== "student-card" || !order.paymentRef) {
    return undefined;
  }

  try {
    const refundResult = await getPaymentProvider().refund(order.paymentRef, order.totalCents);
    if (refundResult.ok === false) {
      const details = [
        `cancelReason=${options?.cancelReason || "unspecified"}`,
        `cancelNote=${options?.cancelNote?.trim() || "none"}`,
        `refund failed: ${refundResult.reason}`,
      ].join("; ");
      recordPaymentReconciliationIncident({
        orderId: order.id,
        transactionRef: order.paymentRef,
        amountCents: order.totalCents,
        incidentType: "refund_failed_after_order_cancel",
        details,
      });
      logError("order.cancel.refund_failed", {
        orderId: order.id,
        transactionRef: order.paymentRef,
        amountCents: order.totalCents,
        cancelReason: options?.cancelReason ?? null,
        cancelNote: options?.cancelNote ?? null,
        refundReason: refundResult.reason,
      });
      return "Order cancelled, but the refund could not be completed automatically. Staff has been notified to reconcile the payment.";
    }

    logInfo("order.cancel.refunded", {
      orderId: order.id,
      transactionRef: order.paymentRef,
      amountCents: order.totalCents,
      cancelReason: options?.cancelReason ?? null,
    });
    return undefined;
  } catch (error) {
    const details = [
      `cancelReason=${options?.cancelReason || "unspecified"}`,
      `cancelNote=${options?.cancelNote?.trim() || "none"}`,
      `refund error: ${error instanceof Error ? error.message : String(error)}`,
    ].join("; ");
    recordPaymentReconciliationIncident({
      orderId: order.id,
      transactionRef: order.paymentRef,
      amountCents: order.totalCents,
      incidentType: "refund_failed_after_order_cancel",
      details,
    });
    logError("order.cancel.refund_exception", {
      orderId: order.id,
      transactionRef: order.paymentRef,
      amountCents: order.totalCents,
      cancelReason: options?.cancelReason ?? null,
      cancelNote: options?.cancelNote ?? null,
      error,
    });
    return "Order cancelled, but the refund could not be completed automatically. Staff has been notified to reconcile the payment.";
  }
}

async function refundOrRecordIncident(input: {
  pendingIncidentId: number;
  orderId: string;
  transactionRef: string;
  amountCents: number;
  userMessage: string;
  failure: unknown;
  paymentMode?: "stub" | "live";
}): Promise<string> {
  if (input.paymentMode === "stub") {
    deletePaymentReconciliationIncident(input.pendingIncidentId);
    logWarn("order.create.stub_payment_reverted", {
      orderId: input.orderId,
      transactionRef: input.transactionRef,
      amountCents: input.amountCents,
      failure: input.failure,
    });
    return "Failed to create order. No payment was taken. Please try again.";
  }

  const paymentProvider = getPaymentProvider();
  let refundResult: PaymentResult;
  try {
    refundResult = await paymentProvider.refund(input.transactionRef, input.amountCents);
  } catch (error) {
    const reason = getErrorMessage(input.failure);
    updatePaymentReconciliationIncident(input.pendingIncidentId, {
      orderId: input.orderId,
      transactionRef: input.transactionRef,
      amountCents: input.amountCents,
      incidentType: "refund_failed_after_order_create_failure",
      details: `${reason}; refund error: ${getErrorMessage(error)}`,
    });
    logError("order.create.refund_exception", {
      orderId: input.orderId,
      transactionRef: input.transactionRef,
      amountCents: input.amountCents,
      failure: input.failure,
      refundError: error,
    });
    return "Payment was processed but the order could not be completed. Staff has been notified to reconcile the transaction.";
  }

  if (refundResult.ok === false) {
    const reason = getErrorMessage(input.failure);
    updatePaymentReconciliationIncident(input.pendingIncidentId, {
      orderId: input.orderId,
      transactionRef: input.transactionRef,
      amountCents: input.amountCents,
      incidentType: "refund_failed_after_order_create_failure",
      details: `${reason}; refund failed: ${refundResult.reason}`,
    });
    logError("order.create.refund_failed", {
      orderId: input.orderId,
      transactionRef: input.transactionRef,
      amountCents: input.amountCents,
      failure: input.failure,
      refundReason: refundResult.reason,
    });
    return "Payment was processed but the order could not be completed. Staff has been notified to reconcile the transaction.";
  }

  deletePaymentReconciliationIncident(input.pendingIncidentId);
  logWarn("order.create.refunded_after_failure", {
    orderId: input.orderId,
    transactionRef: input.transactionRef,
    amountCents: input.amountCents,
    failure: input.failure,
  });
  return input.userMessage;
}

export async function createOrder(
  studentId: string,
  studentName: string,
  input: CreateOrderRequest | unknown
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  let stage = "validate-request";
  let paymentResult: PaymentResult | null = null;
  let handledChargeException = false;

  const validation = validateCreateOrderRequest(input);
  if (validation.ok === false) {
    return { ok: false, error: validation.error };
  }

  const req = validation.value;
  const resolved = resolveOrderItems(req);
  if (resolved.ok === false) {
    return { ok: false, error: resolved.error };
  }

  const orderCreatedAt = new Date();
  const createdAt = toSqlTimestamp(orderCreatedAt);
  const businessDate = getBusinessDate(orderCreatedAt);
  logInfo("order.create.start", {
    studentId,
    pickupWindowId: req.pickupWindowId,
    paymentMethod: req.paymentMethod,
    itemCount: req.items.length,
    businessDate,
  });

  stage = "validate-limits";
  const preChargeLimitCheck = validateOrderLimits(studentId, resolved.items, businessDate);
  if (preChargeLimitCheck.ok === false) {
    logWarn("order.create.rejected", {
      stage,
      studentId,
      businessDate,
      reason: preChargeLimitCheck.error,
    });
    return { ok: false, error: preChargeLimitCheck.error };
  }

  stage = "validate-window";
  const initialWindowCheck = isWindowAcceptingOrders(
    req.pickupWindowId,
    preChargeLimitCheck.hasMadeToOrder,
    businessDate
  );
  if (!initialWindowCheck.ok) {
    logWarn("order.create.rejected", {
      stage,
      studentId,
      businessDate,
      reason: initialWindowCheck.reason,
    });
    return { ok: false, error: initialWindowCheck.reason! };
  }

  stage = "allocate-order-id";
  const orderId = allocateNextOrderId(businessDate);
  const payment = getPaymentProvider();
  logInfo("order.create.order_id_allocated", {
    orderId,
    businessDate,
    paymentMode: payment.mode ?? "live",
  });

  const pendingIncidentId = createPaymentReconciliationIncident({
    orderId,
    transactionRef: orderId,
    amountCents: preChargeLimitCheck.totalCents,
    incidentType: "order_create_payment_inflight",
    details: [
      `studentId=${studentId}`,
      `paymentMethod=${req.paymentMethod}`,
      `businessDate=${businessDate}`,
      `paymentMode=${payment.mode ?? "live"}`,
    ].join("; "),
  });

  stage = "charge";
  try {
    paymentResult = await payment.charge({
      studentId,
      studentName,
      amountCents: preChargeLimitCheck.totalCents,
      orderId,
      method: req.paymentMethod,
    });
  } catch (error) {
    handledChargeException = true;
    if (payment.mode === "stub") {
      deletePaymentReconciliationIncident(pendingIncidentId);
    } else {
      updatePaymentReconciliationIncident(pendingIncidentId, {
        orderId,
        amountCents: preChargeLimitCheck.totalCents,
        incidentType: "order_create_charge_failed",
        details: [
          `studentId=${studentId}`,
          `paymentMethod=${req.paymentMethod}`,
          `businessDate=${businessDate}`,
          `paymentMode=${payment.mode ?? "live"}`,
          `charge error: ${getErrorMessage(error)}`,
        ].join("; "),
      });
    }
    logError("order.create.charge_exception", {
      orderId,
      studentId,
      paymentMethod: req.paymentMethod,
      paymentMode: payment.mode ?? "live",
        amountCents: preChargeLimitCheck.totalCents,
        error,
      });
  }

  if (handledChargeException) {
    return {
      ok: false,
      error:
        payment.mode === "stub"
          ? "Failed to create order. No payment was taken. Please try again."
          : "Payment could not be confirmed. Staff has been notified to reconcile the transaction if a charge was attempted.",
    };
  }

  if (!paymentResult || paymentResult.ok === false) {
    deletePaymentReconciliationIncident(pendingIncidentId);
    logWarn("order.create.payment_failed", {
      orderId,
      studentId,
      paymentMethod: req.paymentMethod,
      paymentMode: payment.mode ?? "live",
      reason: paymentResult?.ok === false ? paymentResult.reason : "unknown",
    });
    return {
      ok: false,
      error:
        paymentResult?.ok === false
          ? `Payment failed: ${paymentResult.reason}`
          : "Payment failed",
    };
  }

  logInfo("order.create.payment_succeeded", {
    orderId,
    studentId,
    paymentMethod: req.paymentMethod,
    paymentMode: payment.mode ?? "live",
    transactionRef: paymentResult.transactionRef,
    amountCents: preChargeLimitCheck.totalCents,
  });

  try {
    stage = "record-payment";
    updatePaymentReconciliationIncident(pendingIncidentId, {
      transactionRef: paymentResult.transactionRef,
      incidentType: "order_create_persist_pending",
      details: [
        `studentId=${studentId}`,
        `paymentMethod=${req.paymentMethod}`,
        `businessDate=${businessDate}`,
        `paymentMode=${payment.mode ?? "live"}`,
        `transactionRef=${paymentResult.transactionRef}`,
      ].join("; "),
    });

    const db = getDb();
    stage = "persist";
    db.transaction(() => {
      const limitCheck = validateOrderLimits(studentId, resolved.items, businessDate);
      if (limitCheck.ok === false) {
        throw new OrderCreationFailure(limitCheck.error);
      }

      const windowCheck = isWindowAcceptingOrders(
        req.pickupWindowId,
        limitCheck.hasMadeToOrder,
        businessDate
      );
      if (!windowCheck.ok) {
        throw new OrderCreationFailure(windowCheck.reason!);
      }

      const stockResult = checkAndReserveStock(
        resolved.items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        }))
      );
      if (!stockResult.ok) {
        throw new OrderCreationFailure(`${stockResult.failedItem} is out of stock`);
      }

      const paymentSettledAt =
        req.paymentMethod === "student-card" ? createdAt : null;

      db.prepare(
        `INSERT INTO orders (
          id,
          student_aad_id,
          student_name,
          pickup_window_id,
          payment_method,
          status,
          total_cents,
          payment_ref,
          payment_settled_at,
          business_date,
          created_at,
          updated_at,
          notes
        ) VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        orderId,
        studentId,
        studentName,
        req.pickupWindowId,
        req.paymentMethod,
        preChargeLimitCheck.totalCents,
        paymentResult.transactionRef,
        paymentSettledAt,
        businessDate,
        createdAt,
        createdAt,
        req.notes || null
      );

      const insertItem = db.prepare(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, price_cents, quantity, item_class)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const item of resolved.items) {
        insertItem.run(orderId, item.menuItemId, item.name, item.priceCents, item.quantity, item.itemClass);
      }
    })();
  } catch (error) {
    logError("order.create.persist_failed", {
      stage,
      orderId,
      studentId,
      businessDate,
      paymentMethod: req.paymentMethod,
      paymentMode: payment.mode ?? "live",
      transactionRef: paymentResult.transactionRef,
      amountCents: preChargeLimitCheck.totalCents,
      error,
    });
    const errorMessage = await refundOrRecordIncident({
      pendingIncidentId,
      orderId,
      transactionRef: paymentResult.transactionRef,
      amountCents: preChargeLimitCheck.totalCents,
      userMessage:
        error instanceof OrderCreationFailure
          ? error.userMessage
          : "Failed to create order after payment; a refund is being processed.",
      failure: error,
      paymentMode: payment.mode,
    });

    return { ok: false, error: errorMessage };
  }

  deletePaymentReconciliationIncident(pendingIncidentId);
  const order = getOrderById(orderId)!;
  logInfo("order.create.success", {
    orderId,
    studentId,
    businessDate,
    paymentMethod: req.paymentMethod,
    paymentMode: payment.mode ?? "live",
    totalCents: order.totalCents,
  });
  return { ok: true, order };
}
const VALID_TRANSITIONS: Record<string, string[]> = {
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["collected", "cancelled"],
};

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  options?: { cancelReason?: string; cancelNote?: string | null }
): Promise<UpdateOrderStatusResult> {
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

  const now = toSqlTimestamp();
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
        if (order.items) {
          restockItems(
            order.items.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              itemClass: item.itemClass,
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

  const updatedOrder = getOrderById(orderId)!;
  if (newStatus !== "cancelled") {
    return { ok: true, order: updatedOrder };
  }

  const warning = await refundCancelledOrder(order, {
    cancelReason,
    cancelNote,
  });
  return warning
    ? { ok: true, order: updatedOrder, warning }
    : { ok: true, order: updatedOrder };
}
