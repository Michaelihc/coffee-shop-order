import { Router } from "express";
import type { Request, Response } from "express";
import { requireStaff } from "../../middleware/authorization";
import { getDashboardStats } from "../../services/dashboard-service";

const router = Router();

router.use(requireStaff);

// GET /api/admin/dashboard
router.get("/", (_req: Request, res: Response) => {
  const stats = getDashboardStats();
  res.json(stats);
});

export default router;
