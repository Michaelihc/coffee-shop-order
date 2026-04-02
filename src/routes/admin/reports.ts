import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { getDb } from "../../db/connection";
import {
  getStudentBalances,
  getStudentSpending,
  balancesToCsv,
  spendingToCsv,
} from "../../services/report-service";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const db = getDb();
  const staff = db
    .prepare("SELECT * FROM staff WHERE aad_id = ? AND role = 'admin'")
    .get(req.user.userId);
  if (!staff) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

router.use(requireAdmin);

// GET /api/admin/reports/balance — JSON
router.get("/balance", (_req: Request, res: Response) => {
  const balances = getStudentBalances();
  const totalDueCents = balances.reduce((sum, b) => sum + b.totalDueCents, 0);
  res.json({ balances, totalDueCents });
});

// GET /api/admin/reports/balance/csv — CSV download
router.get("/balance/csv", (_req: Request, res: Response) => {
  const balances = getStudentBalances();
  const csv = balancesToCsv(balances);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=student-balances.csv");
  res.send(csv);
});

// GET /api/admin/reports/spending — JSON
router.get("/spending", (_req: Request, res: Response) => {
  const spending = getStudentSpending();
  const totalTodaySpendCents = spending.reduce((sum, row) => sum + row.todaySpendCents, 0);
  const totalLifetimeSpendCents = spending.reduce((sum, row) => sum + row.totalSpendCents, 0);
  res.json({ spending, totalTodaySpendCents, totalLifetimeSpendCents });
});

// GET /api/admin/reports/spending/csv — CSV download
router.get("/spending/csv", (_req: Request, res: Response) => {
  const spending = getStudentSpending();
  const csv = spendingToCsv(spending);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=student-spending.csv");
  res.send(csv);
});

export default router;
