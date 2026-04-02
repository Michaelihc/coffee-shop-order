import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { getDb } from "../../db/connection";
import { getDashboardStats } from "../../services/dashboard-service";

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

// GET /api/admin/dashboard
router.get("/", (_req: Request, res: Response) => {
  const stats = getDashboardStats();
  res.json(stats);
});

export default router;
