import { getDb } from "../db/connection";
import { getBusinessHourLabel, getCurrentBusinessDate, parseStoredTimestamp } from "./business-time-service";
import { getPickupWindows } from "./capacity";

export interface DashboardStats {
  ordersToday: number;
  completedToday: number;
  pendingOrders: number;
  readyForPickup: number;
  cancelledToday: number;
  revenueToday: number;
  avgOrderValue: number;
  itemsSoldToday: number;
  topItems: { name: string; sold: number }[];
  lowStockItems: { name: string; stock: number }[];
  windowStats: { label: string; load: number; cap: number; status: string }[];
  hourlyOrders: { hour: string; count: number }[];
}

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  const today = getCurrentBusinessDate();

  const ordersToday = (
    db.prepare(
      "SELECT COUNT(*) as n FROM orders WHERE business_date = ?"
    ).get(today) as { n: number }
  ).n;

  const completedToday = (
    db.prepare(
      "SELECT COUNT(*) as n FROM orders WHERE status = 'collected' AND business_date = ?"
    ).get(today) as { n: number }
  ).n;

  const pendingOrders = (
    db.prepare(
      "SELECT COUNT(*) as n FROM orders WHERE status IN ('confirmed','preparing') AND business_date = ?"
    ).get(today) as { n: number }
  ).n;

  const readyForPickup = (
    db.prepare(
      "SELECT COUNT(*) as n FROM orders WHERE status = 'ready' AND business_date = ?"
    ).get(today) as { n: number }
  ).n;

  const cancelledToday = (
    db.prepare(
      "SELECT COUNT(*) as n FROM orders WHERE status = 'cancelled' AND business_date = ?"
    ).get(today) as { n: number }
  ).n;

  const revenueToday = (
    db.prepare(
      "SELECT COALESCE(SUM(total_cents),0) as s FROM orders WHERE status != 'cancelled' AND business_date = ?"
    ).get(today) as { s: number }
  ).s;

  const nonCancelledOrdersToday = Math.max(ordersToday - cancelledToday, 0);
  const avgOrderValue =
    nonCancelledOrdersToday > 0
      ? Math.round(revenueToday / nonCancelledOrdersToday)
      : 0;

  const itemsSoldToday = (
    db.prepare(
      `SELECT COALESCE(SUM(oi.quantity),0) as s
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelled' AND o.business_date = ?`
    ).get(today) as { s: number }
  ).s;

  const topItems = db
    .prepare(
      `SELECT oi.item_name as name, SUM(oi.quantity) as sold
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelled' AND o.business_date = ?
       GROUP BY oi.item_name ORDER BY sold DESC LIMIT 5`
    )
    .all(today) as { name: string; sold: number }[];

  const lowStockItems = db
    .prepare(
      `SELECT name, stock_count as stock FROM menu_items
       WHERE item_class = 'premade' AND is_available = 1
         AND stock_count IS NOT NULL AND stock_count <= 5
       ORDER BY stock_count ASC`
    )
    .all() as { name: string; stock: number }[];

  const windowStatsWithStatus = getPickupWindows(today)
    .filter((w) => w.isActive)
    .map((w) => {
      const load = w.currentMadeToOrderCount ?? 0;
      const cap = w.madeToOrderCap;

      return {
        label: w.label,
        load,
        cap,
        status: w.status ?? "free",
      };
    });

  const hourlyCounts = new Map<string, number>();
  const hourlyRows = db
    .prepare("SELECT created_at FROM orders WHERE business_date = ?")
    .all(today) as { created_at: string }[];
  for (const row of hourlyRows) {
    const hour = getBusinessHourLabel(parseStoredTimestamp(row.created_at));
    hourlyCounts.set(hour, (hourlyCounts.get(hour) ?? 0) + 1);
  }

  const hourlyOrders = [...hourlyCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([hour, count]) => ({ hour, count }));

  return {
    ordersToday,
    completedToday,
    pendingOrders,
    readyForPickup,
    cancelledToday,
    revenueToday,
    avgOrderValue,
    itemsSoldToday,
    topItems,
    lowStockItems,
    windowStats: windowStatsWithStatus,
    hourlyOrders,
  };
}
