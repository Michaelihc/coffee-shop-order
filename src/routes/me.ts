import { Router } from "express";
import type { Request, Response } from "express";
import { getDb } from "../db/connection";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  if (!req.user) {
    res.json({ role: "student", displayName: "Guest", userId: "" });
    return;
  }

  const db = getDb();
  const staff = db
    .prepare("SELECT * FROM staff WHERE aad_id = ?")
    .get(req.user.userId) as { role: string; display_name: string } | undefined;

  if (staff) {
    res.json({ role: staff.role, displayName: staff.display_name, userId: req.user.userId });
  } else {
    res.json({ role: "student", displayName: req.user.userName, userId: req.user.userId });
  }
});

export default router;
