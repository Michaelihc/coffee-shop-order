import { getDb } from "../db/connection";
import { rowToMenuItem } from "./inventory-service";
import type { Category, MenuItem } from "../types/models";
import type {
  InventoryCreateInput,
  InventoryPatchInput,
  InventoryUpdateInput,
} from "../validation/admin";

export interface InventoryItemRow {
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

interface CategoryRow {
  id: string;
  label: string;
  sort_order: number;
  is_active: number;
}

export function listInventoryData(): { items: MenuItem[]; categories: Category[] } {
  const db = getDb();
  const items = db
    .prepare("SELECT * FROM menu_items ORDER BY category_id, sort_order")
    .all() as InventoryItemRow[];
  const categories = db
    .prepare("SELECT * FROM categories ORDER BY sort_order")
    .all() as CategoryRow[];

  return {
    items: items.map(rowToMenuItem),
    categories: categories.map((row) => ({
      id: row.id,
      label: row.label,
      sortOrder: row.sort_order,
      isActive: row.is_active === 1,
    })),
  };
}

export function inventoryItemExists(itemId: string): boolean {
  const db = getDb();
  return Boolean(db.prepare("SELECT 1 FROM menu_items WHERE id = ?").get(itemId));
}

export function getInventoryItemRecord(itemId: string): InventoryItemRow | null {
  const db = getDb();
  return (db.prepare("SELECT * FROM menu_items WHERE id = ?").get(itemId) as InventoryItemRow | undefined) ?? null;
}

export function createInventoryItem(input: InventoryCreateInput): MenuItem {
  const db = getDb();
  const maxSort = db
    .prepare("SELECT MAX(sort_order) as m FROM menu_items WHERE category_id = ?")
    .get(input.categoryId) as { m: number | null };

  db.prepare(
    `INSERT INTO menu_items (id, category_id, name, description, price_cents, item_class, stock_count, is_available, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    input.id,
    input.categoryId,
    input.name,
    input.description,
    input.priceCents,
    input.itemClass,
    input.itemClass === "premade" ? (input.stockCount ?? 0) : null,
    (maxSort.m ?? -1) + 1
  );

  return rowToMenuItem(getInventoryItemRecord(input.id)!);
}

export function updateInventoryItem(
  itemId: string,
  currentItem: InventoryItemRow,
  input: InventoryUpdateInput
): MenuItem {
  const db = getDb();

  db.prepare(
    `UPDATE menu_items SET
       category_id = COALESCE(?, category_id),
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       price_cents = COALESCE(?, price_cents),
       item_class = COALESCE(?, item_class),
       stock_count = ?,
       sort_order = COALESCE(?, sort_order)
     WHERE id = ?`
  ).run(
    input.categoryId ?? null,
    input.name ?? null,
    input.description ?? null,
    input.priceCents ?? null,
    input.itemClass ?? null,
    (input.itemClass ?? currentItem.item_class) === "premade"
      ? (input.stockCount ?? currentItem.stock_count ?? 0)
      : null,
    input.sortOrder ?? null,
    itemId
  );

  return rowToMenuItem(getInventoryItemRecord(itemId)!);
}

export function deleteInventoryItem(itemId: string): { deleted: boolean; softDeleted?: boolean } {
  const db = getDb();
  const orderRef = db
    .prepare("SELECT COUNT(*) as n FROM order_items WHERE menu_item_id = ?")
    .get(itemId) as { n: number };

  if (orderRef.n > 0) {
    db.prepare("UPDATE menu_items SET is_available = 0 WHERE id = ?").run(itemId);
    return { deleted: false, softDeleted: true };
  }

  db.prepare("DELETE FROM menu_items WHERE id = ?").run(itemId);
  return { deleted: true };
}

export function patchInventoryItem(itemId: string, input: InventoryPatchInput): MenuItem {
  const db = getDb();

  if (input.stockCount !== undefined) {
    db.prepare("UPDATE menu_items SET stock_count = ? WHERE id = ?").run(
      input.stockCount,
      itemId
    );
  }
  if (input.isAvailable !== undefined) {
    db.prepare("UPDATE menu_items SET is_available = ? WHERE id = ?").run(
      input.isAvailable ? 1 : 0,
      itemId
    );
  }

  return rowToMenuItem(getInventoryItemRecord(itemId)!);
}

export function updateInventoryItemImage(itemId: string, imageUrl: string | null): MenuItem {
  const db = getDb();
  db.prepare("UPDATE menu_items SET image_url = ? WHERE id = ?").run(imageUrl, itemId);
  return rowToMenuItem(getInventoryItemRecord(itemId)!);
}
