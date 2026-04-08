import { Router } from "express";
import type { Request, Response } from "express";
import { isAppSettingKey } from "../../config/app-settings";
import { requireAdmin } from "../../middleware/authorization";
import { getAllSettings, setSetting } from "../../services/settings-service";
import { validateSettingValue } from "../../validation/admin";

const router = Router();

router.use(requireAdmin);

// GET /api/admin/settings
router.get("/", (_req: Request, res: Response) => {
  res.json({ settings: getAllSettings() });
});

// PATCH /api/admin/settings/:key
router.patch("/:key", (req: Request, res: Response) => {
  const key = req.params.key as string;
  if (!isAppSettingKey(key)) {
    res.status(404).json({ error: "Setting not found" });
    return;
  }

  const validation = validateSettingValue(key, (req.body as { value?: unknown }).value);
  if (validation.ok === false) {
    res.status(400).json({ error: validation.error });
    return;
  }

  setSetting(key, validation.value);
  res.json({ key, value: validation.value });
});

export default router;
