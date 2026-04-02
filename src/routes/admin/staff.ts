import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { getDb } from "../../db/connection";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const db = getDb();
  const staff = db
    .prepare("SELECT * FROM staff WHERE aad_id = ?")
    .get(req.user.userId) as { role: string } | undefined;
  if (!staff || staff.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

router.use(requireAdmin);

// GET /api/admin/staff — list all staff
router.get("/", (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare("SELECT aad_id, display_name, role FROM staff ORDER BY display_name")
    .all() as { aad_id: string; display_name: string; role: string }[];

  res.json({
    staff: rows.map((r) => ({
      aadId: r.aad_id,
      displayName: r.display_name,
      role: r.role,
    })),
  });
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

  const db = getDb();
  const existing = db.prepare("SELECT * FROM staff WHERE aad_id = ?").get(aadId);
  if (existing) {
    res.status(409).json({ error: "User is already a staff member" });
    return;
  }

  db.prepare("INSERT INTO staff (aad_id, display_name, role) VALUES (?, ?, ?)")
    .run(aadId, displayName, role);

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

  const db = getDb();
  const result = db
    .prepare("UPDATE staff SET role = ? WHERE aad_id = ?")
    .run(role, aadId);

  if (result.changes === 0) {
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

  const db = getDb();
  const result = db.prepare("DELETE FROM staff WHERE aad_id = ?").run(aadId);

  if (result.changes === 0) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
