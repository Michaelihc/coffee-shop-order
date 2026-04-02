import { getDb } from "../db/connection";
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
  const today = new Date().toISOString().slice(0, 10);

  const ordersToday = (
    db.prepare(
      "SELECT COUNT(*) as n FROM orders WHERE date(created_at) = ?"
    ).get(today) as { n: number }
  ).n;

  const completedToday = (
    db.prepare(
      "SELECT COUNT(*) as n FROM orders WHERE status = 'collected' AND date(created_at) = ?"
    ).get(today) as { n: number }
  ).n;

  const pendingOrders = (
    db.prepare(
      "SELECT COUNT(*) as n FROM orders WHERE status IN ('confirmed','preparing') AND date(created_at) = ?"
    ).get(today) as { n: number }
  ).n;

  const readyForPickup = (
    db.prepare(
      "SELECT COUNT(*) as n FROM orders WHERE status = 'ready' AND date(created_at) = ?"
    ).get(today) as { n: number }
  ).n;

  const cancelledToday = (
    db.prepare(
      "SELECT COUNT(*) as n FROM orders WHERE status = 'cancelled' AND date(created_at) = ?"
    ).get(today) as { n: number }
  ).n;

  const revenueToday = (
    db.prepare(
      "SELECT COALESCE(SUM(total_cents),0) as s FROM orders WHERE status != 'cancelled' AND date(created_at) = ?"
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
       WHERE o.status != 'cancelled' AND date(o.created_at) = ?`
    ).get(today) as { s: number }
  ).s;

  const topItems = db
    .prepare(
      `SELECT oi.item_name as name, SUM(oi.quantity) as sold
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelled' AND date(o.created_at) = ?
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

  const windowStatsWithStatus = getPickupWindows()
    .filter((w) => w.isActive)
    .map((w) => {
      const load = w.currentMadeToOrderCount ?? 0;
      const cap = w.madeToOrderCap;
      const pct = cap > 0 ? load / cap : 0;

      console.log("[Dashboard] Window status computed", {
        label: w.label,
        windowId: w.id,
        activeMadeToOrderQuantity: load,
        cap,
        utilization: pct,
        status: w.status,
      });

      return {
        label: w.label,
        load,
        cap,
        status: w.status ?? "free",
      };
    });

  const hourlyOrders = db
    .prepare(
      `SELECT substr(created_at, 12, 2) as hour, COUNT(*) as count
       FROM orders WHERE date(created_at) = ?
       GROUP BY hour ORDER BY hour`
    )
    .all(today) as { hour: string; count: number }[];

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
