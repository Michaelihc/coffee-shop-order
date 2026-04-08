import { Router } from "express";
import type { Request, Response } from "express";
import { requireAdmin } from "../../middleware/authorization";
import {
  getStudentBalances,
  getStudentSpending,
  balancesToCsv,
  spendingToCsv,
} from "../../services/report-service";

const router = Router();

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
