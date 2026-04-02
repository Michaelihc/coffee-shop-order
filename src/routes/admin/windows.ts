import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { getDb } from "../../db/connection";
import { getPickupWindows } from "../../services/capacity";

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

// GET /api/admin/windows
router.get("/", (_req: Request, res: Response) => {
  const windows = getPickupWindows();
  res.json({ windows });
});

// POST /api/admin/windows — create new window
router.post("/", (req: Request, res: Response) => {
  const db = getDb();
  const { id, label, startsAt, endsAt, madeToOrderCap } = req.body as {
    id: string;
    label: string;
    startsAt: string;
    endsAt: string;
    madeToOrderCap: number;
  };

  if (!id || !label || !startsAt || !endsAt || madeToOrderCap == null) {
    res.status(400).json({ error: "Missing required fields (id, label, startsAt, endsAt, madeToOrderCap)" });
    return;
  }

  const existing = db.prepare("SELECT id FROM pickup_windows WHERE id = ?").get(id);
  if (existing) {
    res.status(409).json({ error: "Window with this ID already exists" });
    return;
  }

  const maxSort = db
    .prepare("SELECT MAX(sort_order) as m FROM pickup_windows")
    .get() as { m: number | null };

  db.prepare(
    "INSERT INTO pickup_windows (id, label, starts_at, ends_at, made_to_order_cap, is_active, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)"
  ).run(id, label, startsAt, endsAt, madeToOrderCap, (maxSort.m ?? -1) + 1);

  const windows = getPickupWindows();
  const created = windows.find((w) => w.id === id);
  res.status(201).json({ window: created });
});

// PUT /api/admin/windows/:id — full update
router.put("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const windowId = req.params.id as string;
  const { label, startsAt, endsAt, madeToOrderCap, isActive } = req.body as {
    label?: string;
    startsAt?: string;
    endsAt?: string;
    madeToOrderCap?: number;
    isActive?: boolean;
  };

  const existing = db
    .prepare("SELECT * FROM pickup_windows WHERE id = ?")
    .get(windowId);
  if (!existing) {
    res.status(404).json({ error: "Window not found" });
    return;
  }

  if (label !== undefined) {
    db.prepare("UPDATE pickup_windows SET label = ? WHERE id = ?").run(label, windowId);
  }
  if (startsAt !== undefined) {
    db.prepare("UPDATE pickup_windows SET starts_at = ? WHERE id = ?").run(startsAt, windowId);
  }
  if (endsAt !== undefined) {
    db.prepare("UPDATE pickup_windows SET ends_at = ? WHERE id = ?").run(endsAt, windowId);
  }
  if (madeToOrderCap !== undefined) {
    db.prepare("UPDATE pickup_windows SET made_to_order_cap = ? WHERE id = ?").run(madeToOrderCap, windowId);
  }
  if (isActive !== undefined) {
    db.prepare("UPDATE pickup_windows SET is_active = ? WHERE id = ?").run(isActive ? 1 : 0, windowId);
  }

  const windows = getPickupWindows();
  const updated = windows.find((w) => w.id === windowId);
  res.json({ window: updated });
});

// DELETE /api/admin/windows/:id
router.delete("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const windowId = req.params.id as string;

  const existing = db.prepare("SELECT * FROM pickup_windows WHERE id = ?").get(windowId);
  if (!existing) {
    res.status(404).json({ error: "Window not found" });
    return;
  }

  // Check if any orders reference this window
  const orderRef = db
    .prepare("SELECT COUNT(*) as n FROM orders WHERE pickup_window_id = ?")
    .get(windowId) as { n: number };

  if (orderRef.n > 0) {
    // Soft-delete: deactivate
    db.prepare("UPDATE pickup_windows SET is_active = 0 WHERE id = ?").run(windowId);
    res.json({ deleted: false, deactivated: true });
  } else {
    db.prepare("DELETE FROM pickup_windows WHERE id = ?").run(windowId);
    res.json({ deleted: true });
  }
});

export default router;
