import { Router } from "express";
import type { Request, Response } from "express";
import { requireStaff } from "../../middleware/authorization";
import {
  createPickupWindow,
  deletePickupWindow,
  getPickupWindowRecord,
  listPickupWindowsForAdmin,
  pickupWindowExists,
  updatePickupWindow,
} from "../../services/admin-window-service";
import {
  validateWindowCreatePayload,
  validateWindowUpdatePayload,
} from "../../validation/admin";

const router = Router();

router.use(requireStaff);

// GET /api/admin/windows
router.get("/", (_req: Request, res: Response) => {
  const windows = listPickupWindowsForAdmin();
  res.json({ windows });
});

// POST /api/admin/windows — create new window
router.post("/", (req: Request, res: Response) => {
  const validation = validateWindowCreatePayload(req.body);
  if (validation.ok === false) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const { id } = validation.value;

  if (pickupWindowExists(id)) {
    res.status(409).json({ error: "Window with this ID already exists" });
    return;
  }

  const created = createPickupWindow(validation.value);
  res.status(201).json({ window: created });
});

// PUT /api/admin/windows/:id — full update
router.put("/:id", (req: Request, res: Response) => {
  const windowId = req.params.id as string;
  const validation = validateWindowUpdatePayload(req.body);
  if (validation.ok === false) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const { label, startsAt, endsAt, madeToOrderCap, isActive } = validation.value;

  if (!getPickupWindowRecord(windowId)) {
    res.status(404).json({ error: "Window not found" });
    return;
  }

  const updated = updatePickupWindow(windowId, {
    label,
    startsAt,
    endsAt,
    madeToOrderCap,
    isActive,
  });
  res.json({ window: updated });
});

// DELETE /api/admin/windows/:id
router.delete("/:id", (req: Request, res: Response) => {
  const windowId = req.params.id as string;

  if (!getPickupWindowRecord(windowId)) {
    res.status(404).json({ error: "Window not found" });
    return;
  }

  res.json(deletePickupWindow(windowId));
});

export default router;
