import { getDb } from "../db/connection";

interface SlotRow {
  id: string;
  label: string;
  is_occupied: number;
  current_order_id: string | null;
  zone: string;
}

export function assignGridSlot(orderId: string): string | null {
  const db = getDb();
  const slot = db
    .prepare(
      "SELECT * FROM grid_slots WHERE is_occupied = 0 ORDER BY CAST(id AS INTEGER) LIMIT 1"
    )
    .get() as SlotRow | undefined;

  if (!slot) return null;

  db.prepare(
    "UPDATE grid_slots SET is_occupied = 1, current_order_id = ? WHERE id = ?"
  ).run(orderId, slot.id);

  return slot.id;
}

export function clearGridSlot(slotId: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE grid_slots SET is_occupied = 0, current_order_id = NULL WHERE id = ?"
  ).run(slotId);
}

export function clearGridSlotByOrder(orderId: string): void {
  const db = getDb();
  db.prepare(
    "UPDATE grid_slots SET is_occupied = 0, current_order_id = NULL WHERE current_order_id = ?"
  ).run(orderId);
}

export function getGridSlots() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM grid_slots ORDER BY CAST(id AS INTEGER)")
    .all() as SlotRow[];

  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    isOccupied: r.is_occupied === 1,
    currentOrderId: r.current_order_id,
    zone: r.zone,
  }));
}
