import { getDb } from "../db/connection";
import type { MenuItem } from "../types/models";

interface ItemRow {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  item_class: string;
  stock_count: number | null;
  is_available: number;
  image_url: string | null;
  sort_order: number;
}

const LOW_STOCK_THRESHOLD = 3;

export function getMenuItemById(itemId: string): MenuItem | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM menu_items WHERE id = ?")
    .get(itemId) as ItemRow | undefined;
  if (!row) return null;
  return rowToMenuItem(row);
}

export function checkAndReserveStock(
  items: { menuItemId: string; quantity: number }[]
): { ok: boolean; failedItem?: string } {
  const db = getDb();
  const totalsByItem = new Map<string, number>();

  for (const item of items) {
    totalsByItem.set(item.menuItemId, (totalsByItem.get(item.menuItemId) ?? 0) + item.quantity);
  }

  for (const [menuItemId, quantity] of totalsByItem.entries()) {
    const row = db
      .prepare("SELECT * FROM menu_items WHERE id = ?")
      .get(menuItemId) as ItemRow | undefined;

    if (!row) return { ok: false, failedItem: menuItemId };
    if (row.is_available !== 1) return { ok: false, failedItem: row.name };

    if (row.item_class === "premade" && row.stock_count !== null) {
      if (row.stock_count < quantity) {
        return { ok: false, failedItem: row.name };
      }
    }
  }

  // All checks passed — reserve stock for premade items
  const decrement = db.prepare(
    "UPDATE menu_items SET stock_count = stock_count - ? WHERE id = ? AND item_class = 'premade' AND stock_count IS NOT NULL"
  );
  for (const [menuItemId, quantity] of totalsByItem.entries()) {
    decrement.run(quantity, menuItemId);
  }

  return { ok: true };
}

export function restockItems(
  items: { menuItemId: string; quantity: number; itemClass: string }[]
): void {
  const db = getDb();
  const increment = db.prepare(
    "UPDATE menu_items SET stock_count = stock_count + ? WHERE id = ? AND item_class = 'premade' AND stock_count IS NOT NULL"
  );
  for (const item of items) {
    if (item.itemClass === "premade") {
      increment.run(item.quantity, item.menuItemId);
    }
  }
}

export function rowToMenuItem(row: ItemRow): MenuItem {
  const isAvailable = row.is_available === 1;
  let availabilityLabel: MenuItem["availabilityLabel"];

  if (!isAvailable || (row.item_class === "premade" && row.stock_count !== null && row.stock_count <= 0)) {
    availabilityLabel = "sold-out";
  } else if (row.item_class === "made-to-order") {
    availabilityLabel = "made-fresh";
  } else if (row.stock_count !== null && row.stock_count <= LOW_STOCK_THRESHOLD) {
    availabilityLabel = "limited";
  } else {
    availabilityLabel = "available";
  }

  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    itemClass: row.item_class as MenuItem["itemClass"],
    stockCount: row.stock_count,
    isAvailable,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    availabilityLabel,
  };
}
