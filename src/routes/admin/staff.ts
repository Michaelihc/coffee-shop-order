import { Router } from "express";
import type { Request, Response } from "express";
import { requireAdmin } from "../../middleware/authorization";
import {
  addStaffMember,
  listStaffMembers,
  removeStaffMember,
  staffMemberExists,
  updateStaffMemberRole,
} from "../../services/admin-staff-service";

const router = Router();

router.use(requireAdmin);

// GET /api/admin/staff — list all staff
router.get("/", (_req: Request, res: Response) => {
  res.json({ staff: listStaffMembers() });
});

// POST /api/admin/staff — add a staff member
router.post("/", (req: Request, res: Response) => {
  const { aadId, displayName, role } = req.body;
  if (!aadId || !displayName || !role) {
    res.status(400).json({ error: "aadId, displayName, and role are required" });
    return;
  }
  if (role !== "staff" && role !== "admin") {
    res.status(400).json({ error: "role must be 'staff' or 'admin'" });
    return;
  }

  if (staffMemberExists(aadId)) {
    res.status(409).json({ error: "User is already a staff member" });
    return;
  }

  addStaffMember(aadId, displayName, role);

  res.status(201).json({ ok: true });
});

// PATCH /api/admin/staff/:aadId — update role
router.patch("/:aadId", (req: Request, res: Response) => {
  const aadId = req.params.aadId as string;
  const { role } = req.body;
  if (role !== "staff" && role !== "admin") {
    res.status(400).json({ error: "role must be 'staff' or 'admin'" });
    return;
  }

  if (!updateStaffMemberRole(aadId, role)) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  res.json({ ok: true });
});

// DELETE /api/admin/staff/:aadId — remove staff member
router.delete("/:aadId", (req: Request, res: Response) => {
  const aadId = req.params.aadId as string;

  // Prevent removing yourself
  if (req.user && req.user.userId === aadId) {
    res.status(400).json({ error: "Cannot remove yourself" });
    return;
  }

  if (!removeStaffMember(aadId)) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
