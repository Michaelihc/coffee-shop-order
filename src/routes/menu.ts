import { Router } from "express";
import type { Request, Response } from "express";
import { getDb } from "../db/connection";
import { rowToMenuItem } from "../services/inventory-service";

const router = Router();

interface CategoryRow {
  id: string;
  label: string;
  sort_order: number;
  is_active: number;
}

interface ItemRow {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  item_class: string;
  stock_count: number | null;
  is_available: number;
  is_advertised: number;
  image_url: string | null;
  sort_order: number;
}

router.get("/", (_req: Request, res: Response) => {
  const db = getDb();
  const categories = db
    .prepare("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order")
    .all() as CategoryRow[];

  const itemsByCategory = new Map<string, ReturnType<typeof rowToMenuItem>[]>();
  const items = db
    .prepare("SELECT * FROM menu_items WHERE is_available = 1 ORDER BY sort_order")
    .all() as ItemRow[];

  for (const item of items) {
    const list = itemsByCategory.get(item.category_id) || [];
    list.push(rowToMenuItem(item));
    itemsByCategory.set(item.category_id, list);
  }

  res.json({
    categories: categories.map((c) => ({
      id: c.id,
      label: c.label,
      sortOrder: c.sort_order,
      isActive: c.is_active === 1,
      items: itemsByCategory.get(c.id) || [],
    })),
  });
});

export default router;
