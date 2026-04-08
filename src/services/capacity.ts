import { getDb } from "../db/connection";
import { getCurrentBusinessDate } from "./business-time-service";
import { getSettingInt } from "./settings-service";
import type { PickupWindow, WindowStatus } from "../types/models";

interface WindowRow {
  id: string;
  label: string;
  starts_at: string;
  ends_at: string;
  made_to_order_cap: number;
  is_active: number;
  sort_order: number;
}

export function getPickupWindows(targetDate = getCurrentBusinessDate()): PickupWindow[] {
  const db = getDb();

  const windows = db
    .prepare("SELECT * FROM pickup_windows ORDER BY sort_order")
    .all() as WindowRow[];

  return windows.map((w) => {
    const mtoCount = getMadeToOrderCount(w.id, targetDate);
    return {
      id: w.id,
      label: w.label,
      startsAt: w.starts_at,
      endsAt: w.ends_at,
      madeToOrderCap: w.made_to_order_cap,
      isActive: w.is_active === 1,
      sortOrder: w.sort_order,
      currentMadeToOrderCount: mtoCount,
      status: computeWindowStatus(w.is_active === 1, mtoCount, w.made_to_order_cap),
    };
  });
}

export function getMadeToOrderCount(windowId: string, businessDate: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(oi.quantity), 0) as total
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.pickup_window_id = ?
         AND o.status IN ('confirmed', 'preparing', 'ready')
         AND o.business_date = ?
         AND oi.item_class = 'made-to-order'`
    )
    .get(windowId, businessDate) as { total: number };

  return row.total;
}

export function computeWindowStatus(
  isActive: boolean,
  currentCount: number,
  cap: number
): WindowStatus {
  if (!isActive) return "closed";
  if (cap <= 0) return "closed";
  const ratio = currentCount / cap;
  if (ratio > 1) return "over-capacity";
  if (ratio >= 0.8) return "near-capacity";
  if (ratio >= 0.5) return "busy";
  return "free";
}

export function isWindowAcceptingOrders(
  windowId: string,
  hasMadeToOrder: boolean,
  businessDate = getCurrentBusinessDate()
): { ok: boolean; reason?: string } {
  const db = getDb();
  const w = db
    .prepare("SELECT * FROM pickup_windows WHERE id = ?")
    .get(windowId) as WindowRow | undefined;

  if (!w) return { ok: false, reason: "Pickup window not found" };
  if (w.is_active !== 1) return { ok: false, reason: "Pickup window is closed" };

  if (hasMadeToOrder) {
    const count = getMadeToOrderCount(windowId, businessDate);
    if (count >= w.made_to_order_cap) {
      // Check if cap enforcement is enabled
      const enforceCap = getSettingInt("enforce_window_cap", 1);
      if (enforceCap) {
        return { ok: false, reason: "Pickup window is at capacity for made-to-order items" };
      }
      // Cap not enforced — allow the order through
    }
  }

  return { ok: true };
}
