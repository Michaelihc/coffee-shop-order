import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { getDb } from "../../db/connection";
import { rowToMenuItem } from "../../services/inventory-service";

const router = Router();

function requireStaff(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const db = getDb();
  const staff = db
    .prepare("SELECT * FROM staff WHERE aad_id = ?")
    .get(req.user.userId);
  if (!staff) {
    res.status(403).json({ error: "Staff access required" });
    return;
  }
  next();
}

router.use(requireStaff);

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

// GET /api/admin/inventory
router.get("/", (_req: Request, res: Response) => {
  const db = getDb();
  const items = db
    .prepare("SELECT * FROM menu_items ORDER BY category_id, sort_order")
    .all() as ItemRow[];
  const categories = db
    .prepare("SELECT * FROM categories ORDER BY sort_order")
    .all() as { id: string; label: string; sort_order: number; is_active: number }[];
  res.json({ items: items.map(rowToMenuItem), categories });
});

// POST /api/admin/inventory — create new menu item
router.post("/", (req: Request, res: Response) => {
  const db = getDb();
  const { id, categoryId, name, description, priceCents, itemClass, stockCount } = req.body as {
    id: string;
    categoryId: string;
    name: string;
    description?: string;
    priceCents: number;
    itemClass: string;
    stockCount?: number;
  };

  if (!id || !categoryId || !name || priceCents == null || !itemClass) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const existing = db.prepare("SELECT id FROM menu_items WHERE id = ?").get(id);
  if (existing) {
    res.status(409).json({ error: "Item with this ID already exists" });
    return;
  }

  const maxSort = db
    .prepare("SELECT MAX(sort_order) as m FROM menu_items WHERE category_id = ?")
    .get(categoryId) as { m: number | null };

  db.prepare(
    `INSERT INTO menu_items (id, category_id, name, description, price_cents, item_class, stock_count, is_available, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(id, categoryId, name, description || null, priceCents, itemClass,
    itemClass === "premade" ? (stockCount ?? 0) : null,
    (maxSort.m ?? -1) + 1);

  const created = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id) as ItemRow;
  res.status(201).json({ item: rowToMenuItem(created) });
});

// PUT /api/admin/inventory/:id — full update
router.put("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.id) as ItemRow | undefined;
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const { categoryId, name, description, priceCents, itemClass, stockCount, sortOrder } = req.body as {
    categoryId?: string;
    name?: string;
    description?: string;
    priceCents?: number;
    itemClass?: string;
    stockCount?: number;
    sortOrder?: number;
  };

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
    categoryId ?? null, name ?? null, description ?? null,
    priceCents ?? null, itemClass ?? null,
    (itemClass ?? item.item_class) === "premade" ? (stockCount ?? item.stock_count ?? 0) : null,
    sortOrder ?? null, req.params.id
  );

  const updated = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.id) as ItemRow;
  res.json({ item: rowToMenuItem(updated) });
});

// DELETE /api/admin/inventory/:id — delete item (soft-delete if orders reference it)
router.delete("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.id) as ItemRow | undefined;
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  const orderRef = db.prepare("SELECT COUNT(*) as n FROM order_items WHERE menu_item_id = ?").get(req.params.id) as { n: number };
  if (orderRef.n > 0) {
    // Soft-delete: mark unavailable
    db.prepare("UPDATE menu_items SET is_available = 0 WHERE id = ?").run(req.params.id);
    res.json({ deleted: false, softDeleted: true });
  } else {
    db.prepare("DELETE FROM menu_items WHERE id = ?").run(req.params.id);
    res.json({ deleted: true });
  }
});

// PATCH /api/admin/inventory/:id
router.patch("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const { stockCount, isAvailable } = req.body as {
    stockCount?: number;
    isAvailable?: boolean;
  };

  const item = db
    .prepare("SELECT * FROM menu_items WHERE id = ?")
    .get(req.params.id) as ItemRow | undefined;
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  if (stockCount !== undefined) {
    db.prepare("UPDATE menu_items SET stock_count = ? WHERE id = ?").run(
      stockCount,
      req.params.id
    );
  }
  if (isAvailable !== undefined) {
    db.prepare("UPDATE menu_items SET is_available = ? WHERE id = ?").run(
      isAvailable ? 1 : 0,
      req.params.id
    );
  }

  const updated = db
    .prepare("SELECT * FROM menu_items WHERE id = ?")
    .get(req.params.id) as ItemRow;
  res.json({ item: rowToMenuItem(updated) });
});

// Image upload setup
const uploadsDir = process.env.DB_PATH
  ? path.join(path.dirname(process.env.DB_PATH), "images")
  : path.join(process.cwd(), "data", "images");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// POST /api/admin/inventory/:id/image — upload image
router.post("/:id/image", (req: Request, res: Response) => {
  upload.single("image")(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload error";
      console.error("[image-upload] multer error:", msg);
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: "File too large (max 2MB)" });
          return;
        }
        res.status(400).json({ error: msg });
        return;
      }
      res.status(400).json({ error: msg });
      return;
    }

    try {
      const db = getDb();
      const itemId = req.params.id as string;
      console.log("[image-upload] item=%s, file=%s, dest=%s", itemId, req.file?.originalname, uploadsDir);

      const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(itemId) as ItemRow | undefined;
      if (!item) {
        console.warn("[image-upload] item not found:", itemId);
        res.status(404).json({ error: "Item not found" });
        return;
      }

      if (!req.file) {
        console.warn("[image-upload] no file in request");
        res.status(400).json({ error: "No image file provided" });
        return;
      }

      // Delete old image if exists
      if (item.image_url) {
        const oldPath = path.join(uploadsDir, path.basename(item.image_url));
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          console.log("[image-upload] deleted old image:", oldPath);
        }
      }

      const imageUrl = `/uploads/${req.file.filename}`;
      db.prepare("UPDATE menu_items SET image_url = ? WHERE id = ?").run(imageUrl, itemId);
      console.log("[image-upload] saved:", imageUrl);

      const updated = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(itemId) as ItemRow;
      res.json({ item: rowToMenuItem(updated) });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Internal error";
      console.error("[image-upload] handler error:", msg, e);
      res.status(500).json({ error: msg });
    }
  });
});

// DELETE /api/admin/inventory/:id/image — remove image
router.delete("/:id/image", (req: Request, res: Response) => {
  const db = getDb();
  const item = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.id) as ItemRow | undefined;
  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  if (item.image_url) {
    const imgPath = path.join(uploadsDir, path.basename(item.image_url));
    if (fs.existsSync(imgPath)) {
      fs.unlinkSync(imgPath);
    }
  }

  db.prepare("UPDATE menu_items SET image_url = NULL WHERE id = ?").run(req.params.id);

  const updated = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.id) as ItemRow;
  res.json({ item: rowToMenuItem(updated) });
});

export default router;
