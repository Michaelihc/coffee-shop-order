import { getDb } from "../db/connection";
import { getPickupWindows } from "./capacity";
import type { PickupWindow } from "../types/models";
import type { WindowCreateInput, WindowUpdateInput } from "../validation/admin";

interface WindowRow {
  id: string;
}

export function listPickupWindowsForAdmin(targetDate?: string): PickupWindow[] {
  return getPickupWindows(targetDate);
}

export function pickupWindowExists(windowId: string): boolean {
  const db = getDb();
  return Boolean(db.prepare("SELECT 1 FROM pickup_windows WHERE id = ?").get(windowId));
}

export function createPickupWindow(input: WindowCreateInput): PickupWindow | null {
  const db = getDb();
  const maxSort = db
    .prepare("SELECT MAX(sort_order) as m FROM pickup_windows")
    .get() as { m: number | null };

  db.prepare(
    "INSERT INTO pickup_windows (id, label, starts_at, ends_at, made_to_order_cap, is_active, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)"
  ).run(input.id, input.label, input.startsAt, input.endsAt, input.madeToOrderCap, (maxSort.m ?? -1) + 1);

  return listPickupWindowsForAdmin().find((window) => window.id === input.id) ?? null;
}

export function updatePickupWindow(windowId: string, input: WindowUpdateInput): PickupWindow | null {
  const db = getDb();

  if (input.label !== undefined) {
    db.prepare("UPDATE pickup_windows SET label = ? WHERE id = ?").run(input.label, windowId);
  }
  if (input.startsAt !== undefined) {
    db.prepare("UPDATE pickup_windows SET starts_at = ? WHERE id = ?").run(input.startsAt, windowId);
  }
  if (input.endsAt !== undefined) {
    db.prepare("UPDATE pickup_windows SET ends_at = ? WHERE id = ?").run(input.endsAt, windowId);
  }
  if (input.madeToOrderCap !== undefined) {
    db.prepare("UPDATE pickup_windows SET made_to_order_cap = ? WHERE id = ?").run(input.madeToOrderCap, windowId);
  }
  if (input.isActive !== undefined) {
    db.prepare("UPDATE pickup_windows SET is_active = ? WHERE id = ?").run(input.isActive ? 1 : 0, windowId);
  }

  return listPickupWindowsForAdmin().find((window) => window.id === windowId) ?? null;
}

export function deletePickupWindow(windowId: string): { deleted: boolean; deactivated?: boolean } {
  const db = getDb();
  const orderRef = db
    .prepare("SELECT COUNT(*) as n FROM orders WHERE pickup_window_id = ?")
    .get(windowId) as { n: number };

  if (orderRef.n > 0) {
    db.prepare("UPDATE pickup_windows SET is_active = 0 WHERE id = ?").run(windowId);
    return { deleted: false, deactivated: true };
  }

  db.prepare("DELETE FROM pickup_windows WHERE id = ?").run(windowId);
  return { deleted: true };
}

export function getPickupWindowRecord(windowId: string): WindowRow | null {
  const db = getDb();
  return (db.prepare("SELECT id FROM pickup_windows WHERE id = ?").get(windowId) as WindowRow | undefined) ?? null;
}
