import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { getDb } from "../../db/connection";
import { getAllSettings, setSetting } from "../../services/settings-service";

const router = Router();
const POSITIVE_INTEGER_SETTINGS = new Set([
  "max_items_per_order",
  "max_order_total_cents",
  "daily_spend_limit_cents",
]);

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

// GET /api/admin/settings
router.get("/", (_req: Request, res: Response) => {
  res.json({ settings: getAllSettings() });
});

// PATCH /api/admin/settings/:key
router.patch("/:key", (req: Request, res: Response) => {
  const { value } = req.body as { value: string };
  if (value === undefined) {
    res.status(400).json({ error: "Missing value" });
    return;
  }
  const key = req.params.key as string;
  const normalizedValue = String(value).trim();

  if (key === "enforce_window_cap") {
    if (normalizedValue !== "0" && normalizedValue !== "1") {
      res.status(400).json({ error: "enforce_window_cap must be 0 or 1" });
      return;
    }
  } else if (POSITIVE_INTEGER_SETTINGS.has(key)) {
    const parsed = Number.parseInt(normalizedValue, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      res.status(400).json({ error: `${key} must be a positive integer` });
      return;
    }
  }

  setSetting(key, normalizedValue);
  res.json({ key, value: normalizedValue });
});

export default router;
