import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { getDb } from "../../db/connection";
import {
  getGridSlots,
  clearGridSlot,
} from "../../services/grid-service";
import { updateOrderStatus } from "../../services/order-service";

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

// GET /api/admin/grid
router.get("/", (_req: Request, res: Response) => {
  const slots = getGridSlots();
  const db = getDb();

  const enriched = slots.map((slot) => {
    if (!slot.currentOrderId) return slot;
    const order = db
      .prepare("SELECT student_name, id, pickup_code FROM orders WHERE id = ?")
      .get(slot.currentOrderId) as { student_name: string; id: string; pickup_code: string | null } | undefined;
    return {
      ...slot,
      studentName: order?.student_name ?? null,
      pickupCode: order?.pickup_code ?? null,
    };
  });

  res.json({ slots: enriched });
});

// PATCH /api/admin/grid/:id — clear a slot (marks order as collected)
router.patch("/:id", (req: Request, res: Response) => {
  const { clear } = req.body as { clear?: boolean };
  if (!clear) {
    res.status(400).json({ error: "Expected { clear: true }" });
    return;
  }

  const slots = getGridSlots();
  const slot = slots.find((s) => s.id === (req.params.id as string));
  if (!slot) {
    res.status(404).json({ error: "Slot not found" });
    return;
  }

  if (slot.currentOrderId) {
    updateOrderStatus(slot.currentOrderId, "collected");
  } else {
    clearGridSlot(req.params.id as string);
  }

  res.json({ slots: getGridSlots() });
});

export default router;
